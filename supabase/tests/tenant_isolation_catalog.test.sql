-- pgTAP: Generic tenant isolation test via catalog introspection
-- Dynamically tests ALL tables with org_id column
-- Tests: (a) RLS enabled, (b) anon has no privileges, (c) authenticated lacks TRUNCATE, 
--        (d) FK constraints include org_id, (e) org FK cascade, (f) SET NULL checks, (g) conflicting FKs

begin;
set local role postgres;

select plan(8);

-- ============================================================================
-- Test 1: Assert we found >= 14 tables with org_id
-- ============================================================================

select ok(
  (
    select count(*) >= 14
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'org_id'
      and not a.attisdropped
  ),
  'Found >= 14 tables with org_id column'
);

-- ============================================================================
-- Test 2: anon has zero privileges on any public table or sequence
-- ============================================================================

select is_empty(
  $$
    select c.relname, privilege_type
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join lateral (
      select privilege_type
      from (
        select 'SELECT' as privilege_type, has_table_privilege('anon', c.oid, 'select') as has_priv
        union all select 'INSERT', has_table_privilege('anon', c.oid, 'insert')
        union all select 'UPDATE', has_table_privilege('anon', c.oid, 'update')
        union all select 'DELETE', has_table_privilege('anon', c.oid, 'delete')
        union all select 'TRUNCATE', has_table_privilege('anon', c.oid, 'truncate')
        union all select 'REFERENCES', has_table_privilege('anon', c.oid, 'references')
        union all select 'TRIGGER', has_table_privilege('anon', c.oid, 'trigger')
      ) privs
      where has_priv
    ) privs on true
    where n.nspname = 'public'
      and c.relkind in ('r', 'S')
      and privilege_type is not null
  $$,
  'anon has zero privileges on any public table or sequence'
);

-- ============================================================================
-- Test 3: Every org_id table has RLS enabled
-- ============================================================================

select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'org_id'
      and not a.attisdropped
      and not c.relrowsecurity
  $$,
  'Every org_id table has RLS enabled'
);

-- ============================================================================
-- Test 4: Every org_id table has FK on org_id to orgs with ON DELETE CASCADE
-- ============================================================================

select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'org_id'
      and not a.attisdropped
      and not exists (
        select 1
        from pg_constraint con
        join pg_class fc on fc.oid = con.confrelid
        join pg_namespace fn on fn.oid = fc.relnamespace
        join pg_attribute ca on ca.attrelid = con.conrelid
        where con.conrelid = c.oid
          and con.contype = 'f'
          and fn.nspname = 'public'
          and fc.relname = 'orgs'
          and ca.attnum = any(con.conkey)
          and ca.attname = 'org_id'
          and con.confdeltype = 'c'
      )
  $$,
  'Every org_id table has FK on org_id to orgs with ON DELETE CASCADE'
);

-- ============================================================================
-- Test 5: Every FK to another org_id table includes org_id in column list
-- ============================================================================

select is_empty(
  $$
    select source.relname as source_table, 
           target.relname as target_table,
           con.conname as constraint_name,
           array_to_string(array_agg(sa.attname order by ordinality), ', ') as fk_columns
    from pg_constraint con
    join pg_class source on source.oid = con.conrelid
    join pg_class target on target.oid = con.confrelid
    join pg_namespace sn on sn.oid = source.relnamespace
    join pg_namespace tn on tn.oid = target.relnamespace
    join unnest(con.conkey) with ordinality as conkey(attnum, ordinality) on true
    join pg_attribute sa on sa.attrelid = source.oid and sa.attnum = conkey.attnum
    where con.contype = 'f'
      and sn.nspname = 'public'
      and tn.nspname = 'public'
      -- Source table has org_id
      and exists (
        select 1 from pg_attribute 
        where attrelid = source.oid and attname = 'org_id' and not attisdropped
      )
      -- Target table has org_id
      and exists (
        select 1 from pg_attribute 
        where attrelid = target.oid and attname = 'org_id' and not attisdropped
      )
      -- Exception: single-column FKs to orgs(id) or profiles(id) are allowed
      and not (target.relname in ('orgs', 'profiles') and array_length(con.conkey, 1) = 1)
    group by source.relname, target.relname, con.conname, con.conkey
    having not ('org_id' = any(array_agg(sa.attname)))
  $$,
  'Every FK to another org_id table includes org_id in column list'
);

-- ============================================================================
-- Test 6: No ON DELETE SET NULL/DEFAULT FK touches a NOT NULL column
-- ============================================================================

select is_empty(
  $$
    select con.conrelid::regclass as table_name, con.conname, a.attname as not_null_column
    from pg_constraint con
    join lateral unnest(coalesce(con.confdelsetcols, con.conkey)) k(attnum) on true
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
    where con.contype = 'f' and con.confdeltype in ('n','d')
      and con.connamespace = 'public'::regnamespace and a.attnotnull
  $$,
  'No ON DELETE SET NULL/DEFAULT FK touches a NOT NULL column'
);

-- ============================================================================
-- Test 7: No two FKs on the same column disagree on ON DELETE
-- ============================================================================

select is_empty(
  $$
    select c1.conrelid::regclass, a.attname, c1.conname, c2.conname
    from pg_constraint c1
    join pg_constraint c2 on c2.conrelid = c1.conrelid and c2.contype = 'f'
         and c1.conname < c2.conname and c1.confrelid = c2.confrelid
         and c1.confdeltype <> c2.confdeltype
    join pg_attribute a on a.attrelid = c1.conrelid
         and a.attnum = any(c1.conkey) and a.attnum = any(c2.conkey)
    where c1.contype = 'f' and c1.connamespace = 'public'::regnamespace
  $$,
  'No two FKs on the same column disagree on ON DELETE'
);

-- ============================================================================
-- Test 8: authenticated cannot TRUNCATE any tenant table
-- ============================================================================

select is_empty(
  $$
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'org_id'
      and not a.attisdropped
      and has_table_privilege('authenticated', c.oid, 'truncate')
  $$,
  'authenticated cannot TRUNCATE any tenant table'
);

select * from finish();
rollback;
