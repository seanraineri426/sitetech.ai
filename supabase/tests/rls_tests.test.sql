-- pgTAP tests for RLS policies
-- Run with: supabase test db

begin;
select plan(30);

-- Setup test data
set local role postgres;

-- Create test users
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values 
  ('11111111-1111-1111-1111-111111111111', 'user1@test.com', crypt('password', gen_salt('bf')), now(), '{"full_name": "User One"}'),
  ('22222222-2222-2222-2222-222222222222', 'user2@test.com', crypt('password', gen_salt('bf')), now(), '{"full_name": "User Two"}'),
  ('33333333-3333-3333-3333-333333333333', 'admin@test.com', crypt('password', gen_salt('bf')), now(), '{"full_name": "Admin User"}'),
  ('44444444-4444-4444-4444-444444444444', 'member@test.com', crypt('password', gen_salt('bf')), now(), '{"full_name": "Member User"}');

-- Create test orgs
insert into public.orgs (id, name, slug) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A', 'org-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B', 'org-b');

-- Create memberships
insert into public.org_memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

-- Create projects
insert into public.projects (id, org_id, name) values
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Project A1'),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Project B1');

-- Create audit log entries
insert into public.audit_log (org_id, actor_type, action, target_table) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'system', 'test_action', 'orgs'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'system', 'test_action', 'orgs');

-- ============================================================================
-- TEST 1: Cross-org isolation (orgs table)
-- ============================================================================

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';

select results_eq(
  'select count(*)::int from public.orgs',
  array[1],
  'User in Org A sees only Org A'
);

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222"}';

select results_eq(
  'select count(*)::int from public.orgs',
  array[1],
  'User in Org B sees only Org B'
);

-- ============================================================================
-- TEST 2: Cross-org isolation (projects table)
-- ============================================================================

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';

select results_eq(
  'select count(*)::int from public.projects',
  array[1],
  'User in Org A sees only Org A projects'
);

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222"}';

select results_eq(
  'select count(*)::int from public.projects',
  array[1],
  'User in Org B sees only Org B projects'
);

-- ============================================================================
-- TEST 3: Cross-org isolation (org_memberships table)
-- ============================================================================

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';

select results_eq(
  'select count(*)::int from public.org_memberships',
  array[3],
  'User in Org A sees only Org A memberships'
);

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222"}';

select results_eq(
  'select count(*)::int from public.org_memberships',
  array[1],
  'User in Org B sees only Org B memberships'
);

-- ============================================================================
-- TEST 4: Cross-org isolation (profiles table)
-- ============================================================================

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';

select results_eq(
  'select count(*)::int from public.profiles',
  array[4],
  'User in Org A sees profiles in their org plus their own'
);

-- ============================================================================
-- TEST 5: Cross-org isolation (audit_log table)
-- ============================================================================

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';

select results_eq(
  'select count(*)::int from public.audit_log where org_id is not null',
  array[1],
  'User in Org A sees only Org A audit logs'
);

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222"}';

select results_eq(
  'select count(*)::int from public.audit_log where org_id is not null',
  array[1],
  'User in Org B sees only Org B audit logs'
);

-- ============================================================================
-- TEST 6: Member cannot update org
-- ============================================================================

set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444"}';

select throws_ok(
  $$update public.orgs set name = 'Updated' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'new row violates row-level security policy for table "orgs"',
  'Member cannot update org'
);

-- ============================================================================
-- TEST 7: Member cannot create projects
-- ============================================================================

select throws_ok(
  $$insert into public.projects (org_id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'New Project')$$,
  'new row violates row-level security policy for table "projects"',
  'Member cannot create project'
);

-- ============================================================================
-- TEST 8: Admin cannot promote to owner
-- ============================================================================

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333"}';

select throws_ok(
  $$insert into public.org_memberships (org_id, user_id, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner')$$,
  'new row violates row-level security policy for table "org_memberships"',
  'Admin cannot insert owner role'
);

-- ============================================================================
-- TEST 9: Admin cannot modify owner
-- ============================================================================

select throws_ok(
  $$update public.org_memberships set role = 'admin' where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '11111111-1111-1111-1111-111111111111'$$,
  'new row violates row-level security policy for table "org_memberships"',
  'Admin cannot modify owner role'
);

-- ============================================================================
-- TEST 10: Admin cannot remove owner
-- ============================================================================

select throws_ok(
  $$delete from public.org_memberships where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '11111111-1111-1111-1111-111111111111'$$,
  'new row violates row-level security policy for table "org_memberships"',
  'Admin cannot remove owner'
);

-- ============================================================================
-- TEST 11: Admin cannot change own role
-- ============================================================================

select throws_ok(
  $$update public.org_memberships set role = 'owner' where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '33333333-3333-3333-3333-333333333333'$$,
  'new row violates row-level security policy for table "org_memberships"',
  'Admin cannot change own role'
);

-- ============================================================================
-- TEST 12: Owner can update org
-- ============================================================================

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';

select lives_ok(
  $$update public.orgs set name = 'Updated Org A' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'Owner can update org'
);

-- ============================================================================
-- TEST 13: Owner can create projects
-- ============================================================================

select lives_ok(
  $$insert into public.projects (org_id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Owner Project')$$,
  'Owner can create project'
);

-- ============================================================================
-- TEST 14: Owner can promote to owner
-- ============================================================================

select lives_ok(
  $$update public.org_memberships set role = 'owner' where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '33333333-3333-3333-3333-333333333333'$$,
  'Owner can promote admin to owner'
);

-- Reset for next tests
update public.org_memberships set role = 'admin' where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '33333333-3333-3333-3333-333333333333';

-- ============================================================================
-- TEST 15: Admin can manage member/admin roles
-- ============================================================================

set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333"}';

select lives_ok(
  $$update public.org_memberships set role = 'admin' where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '44444444-4444-4444-4444-444444444444'$$,
  'Admin can promote member to admin'
);

-- Reset
update public.org_memberships set role = 'member' where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '44444444-4444-4444-4444-444444444444';

-- ============================================================================
-- TEST 16: create_org makes caller the owner
-- ============================================================================

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222"}';

select lives_ok(
  $$select public.create_org('Test Org', 'test-org')$$,
  'create_org succeeds'
);

select results_eq(
  $$select role from public.org_memberships om join public.orgs o on om.org_id = o.id where o.slug = 'test-org' and om.user_id = '22222222-2222-2222-2222-222222222222'$$,
  array['owner'::text],
  'Caller is owner of created org'
);

-- ============================================================================
-- TEST 17: Last owner removal is refused
-- ============================================================================

set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222"}';

select throws_ok(
  $$delete from public.org_memberships where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and user_id = '22222222-2222-2222-2222-222222222222'$$,
  'Cannot remove the last owner from an organization',
  'Cannot remove last owner'
);

-- ============================================================================
-- TEST 18: Owner can delete org (cascade deletes memberships)
-- ============================================================================

set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';

select lives_ok(
  $$delete from public.orgs where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'Owner can delete org'
);

select results_eq(
  'select count(*)::int from public.org_memberships where org_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  array[0],
  'Memberships cascade deleted with org'
);

-- ============================================================================
-- TEST 19: anon cannot execute helper functions
-- ============================================================================

set local role anon;
reset request.jwt.claims;

select throws_ok(
  $$select public.is_org_member('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,
  'permission denied for function is_org_member',
  'anon cannot call is_org_member'
);

select throws_ok(
  $$select public.has_org_role('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', array['owner'])$$,
  'permission denied for function has_org_role',
  'anon cannot call has_org_role'
);

select throws_ok(
  $$select public.create_org('Anon Org', 'anon-org')$$,
  'permission denied for function create_org',
  'anon cannot call create_org'
);

-- ============================================================================
-- TEST 20: Authenticated user cannot insert into audit_log
-- ============================================================================

set local role authenticated;
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222"}';

select throws_ok(
  $$insert into public.audit_log (org_id, actor_type, action) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user', 'bad_action')$$,
  'new row violates row-level security policy for table "audit_log"',
  'Authenticated user cannot insert into audit_log'
);

-- ============================================================================
-- TEST 21: Member can leave org
-- ============================================================================

-- First add member to Org B
set local role postgres;
insert into public.org_memberships (org_id, user_id, role) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'member');

set local role authenticated;
set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444"}';

select lives_ok(
  $$delete from public.org_memberships where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and user_id = '44444444-4444-4444-4444-444444444444'$$,
  'Member can delete own membership (leave org)'
);

select * from finish();
rollback;
