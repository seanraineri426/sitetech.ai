-- pgTAP: Generic tenant isolation test via catalog introspection
-- Dynamically tests ALL tables with org_id column
-- Tests: (a) RLS enabled, (b) anon has no privileges, (c) authenticated lacks TRUNCATE, (d) FK constraints include org_id

begin;
select no_plan();

-- ============================================================================
-- Test (a): RLS is enabled on every public table with org_id
-- ============================================================================

select ok(
  (
    select count(*) = 0
    from information_schema.columns c
    left join pg_class pc on pc.oid = (c.table_schema || '.' || c.table_name)::regclass
    where c.column_name = 'org_id'
      and c.table_schema = 'public'
      and not pc.relrowsecurity
  ),
  'RLS is enabled on all tables with org_id'
);

-- ============================================================================
-- Test (b): anon has no write privileges on tenant tables
-- ============================================================================

do $$
declare
  r record;
  has_write_priv boolean;
begin
  for r in 
    select distinct table_name
    from information_schema.columns
    where column_name = 'org_id' and table_schema = 'public'
  loop
    -- Check write privileges (not SELECT - RLS handles reads)
    select 
      has_table_privilege('anon', 'public.' || r.table_name, 'insert') or
      has_table_privilege('anon', 'public.' || r.table_name, 'update') or
      has_table_privilege('anon', 'public.' || r.table_name, 'delete') or
      has_table_privilege('anon', 'public.' || r.table_name, 'truncate')
    into has_write_priv;
    
    if has_write_priv then
      raise exception 'anon has write privileges on %', r.table_name;
    end if;
  end loop;
end;
$$;

select ok(true, 'anon has no write privileges on any tenant table');

-- ============================================================================
-- Test (c): authenticated lacks TRUNCATE on all tenant tables
-- ============================================================================

do $$
declare
  r record;
begin
  for r in 
    select distinct table_name
    from information_schema.columns
    where column_name = 'org_id' and table_schema = 'public'
  loop
    if has_table_privilege('authenticated', 'public.' || r.table_name, 'truncate') then
      raise exception 'authenticated can TRUNCATE %', r.table_name;
    end if;
  end loop;
end;
$$;

select ok(true, 'authenticated cannot TRUNCATE any tenant table');

-- ============================================================================
-- Test (d): Every FK to another org_id table includes org_id in column list
-- ============================================================================

do $$
declare
  violation_found boolean := false;
  r record;
begin
  for r in
    select
      tc.constraint_name,
      tc.table_name as source_table,
      ccu.table_name as referenced_table,
      array_agg(kcu.column_name order by kcu.ordinal_position) as fk_columns
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
      and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name
      and tc.table_schema = ccu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      -- Source table has org_id
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = tc.table_name
          and column_name = 'org_id'
      )
      -- Referenced table also has org_id
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = ccu.table_name
          and column_name = 'org_id'
      )
    group by tc.constraint_name, tc.table_name, ccu.table_name
  loop
    -- Exception: single-column FKs to orgs(id) or profiles(id) are allowed
    if r.referenced_table in ('orgs', 'profiles') and array_length(r.fk_columns, 1) = 1 then
      continue;
    end if;
    
    -- FK must include org_id
    if not ('org_id' = any(r.fk_columns)) then
      raise warning 'FK % on %.% to %.% does not include org_id (columns: %)',
        r.constraint_name, 'public', r.source_table, 'public', r.referenced_table,
        array_to_string(r.fk_columns, ', ');
      violation_found := true;
    end if;
  end loop;
  
  if violation_found then
    raise exception 'Found FK constraints missing org_id - cross-org data leak possible';
  end if;
end;
$$;

select ok(true, 'All FK constraints to tenant tables include org_id');

select * from finish();
rollback;
