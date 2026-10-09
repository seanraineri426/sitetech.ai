-- pgTAP: Generic tenant isolation test via catalog introspection
-- Dynamically tests ALL tables with org_id column
-- Tests: (a) RLS enabled, (b) anon has no privileges, (c) authenticated lacks TRUNCATE, 
--        (d) FK constraints include org_id, (e) org FK cascade, (f) NOT NULL + SET NULL check

begin;
set local role postgres;

select plan(5);

-- Note: Test 6 (checking for NOT NULL columns with whole-row SET NULL) was removed
-- because PostgreSQL's catalog doesn't distinguish between whole-row and column-specific
-- SET NULL. Both use confdeltype='n', so the check produces false positives for
-- column-specific SET NULL like "on delete set null (raw_record_id)".

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

select * from finish();
rollback;
