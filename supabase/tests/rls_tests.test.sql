-- pgTAP tests for RLS policies
-- Run as authenticator user (not superuser) to properly test RLS

begin;
select plan(28);

-- Setup test data (need elevated privileges briefly)
set role postgres;

insert into auth.users (id, email, raw_user_meta_data)
values 
  ('11111111-1111-1111-1111-111111111111', 'user1@test.com', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'user2@test.com', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'admin@test.com', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'member@test.com', '{}');

insert into public.orgs (id, name, slug) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A', 'org-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B', 'org-b');

insert into public.org_memberships (org_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

insert into public.projects (id, org_id, name) values
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Project A1'),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Project B1');

insert into public.audit_log (org_id, actor_type, action, target_table) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'system', 'test_action', 'orgs'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'system', 'test_action', 'orgs');

reset role;

-- ============================================================================
-- CROSS-ORG ISOLATION TESTS
-- ============================================================================

-- Test 1-2: Orgs
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.orgs), 1, 'User in Org A sees only Org A');
reset role;

set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.orgs), 1, 'User in Org B sees only Org B');
reset role;

-- Test 3-4: Projects
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.projects), 1, 'User in Org A sees only Org A projects');
reset role;

set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.projects), 1, 'User in Org B sees only Org B projects');
reset role;

-- Test 5-6: Memberships
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.org_memberships), 3, 'User in Org A sees only Org A memberships');
reset role;

set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.org_memberships), 1, 'User in Org B sees only Org B memberships');
reset role;

-- Test 7: Profiles
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.profiles), 3, 'User in Org A sees 3 profiles (members of Org A)');
reset role;

-- Test 8: Audit logs
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.audit_log where org_id is not null), 1, 'User in Org A sees only Org A audit logs');
reset role;

-- ============================================================================
-- MEMBER PERMISSIONS TESTS
-- ============================================================================

-- Test 9: Member cannot update org (value unchanged)
set role authenticated;
set local "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
update public.orgs set name = 'Member Updated' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set role postgres;
select is((select name from public.orgs where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 'Org A', 'Member cannot update org (value unchanged)');
reset role;

-- Test 10: Member cannot create projects
set role authenticated;
set local "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
select throws_ok(
  $$insert into public.projects (org_id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'New Project')$$,
  '42501',
  null,
  'Member cannot create project'
);
reset role;

-- ============================================================================
-- ADMIN PERMISSIONS TESTS
-- ============================================================================

-- Test 11: Admin cannot promote to owner
set role authenticated;
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
select throws_ok(
  $$insert into public.org_memberships (org_id, user_id, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'owner')$$,
  '42501',
  null,
  'Admin cannot insert owner role'
);
reset role;

-- Test 12: Admin cannot modify owner (role unchanged)
set role authenticated;
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
update public.org_memberships set role = 'member' where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '11111111-1111-1111-1111-111111111111';
set role postgres;
select is((select role from public.org_memberships where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '11111111-1111-1111-1111-111111111111'), 'owner', 'Admin cannot modify owner role (unchanged)');
reset role;

-- Test 13: Admin cannot remove owner (still exists)
set role authenticated;
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
delete from public.org_memberships where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '11111111-1111-1111-1111-111111111111';
set role postgres;
select is((select count(*)::int from public.org_memberships where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '11111111-1111-1111-1111-111111111111'), 1, 'Admin cannot remove owner (still exists)');
reset role;

-- Test 14: Admin cannot change own role (role unchanged)
set role authenticated;
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
update public.org_memberships set role = 'owner' where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '33333333-3333-3333-3333-333333333333';
set role postgres;
select is((select role from public.org_memberships where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '33333333-3333-3333-3333-333333333333'), 'admin', 'Admin cannot change own role (unchanged)');
reset role;

-- ============================================================================
-- OWNER PERMISSIONS TESTS
-- ============================================================================

-- Test 15: Owner can update org
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
prepare owner_update_org as update public.orgs set name = 'Updated Org A' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok('owner_update_org', 'Owner can update org');
reset role;

-- Test 16: Owner can create projects
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
prepare owner_create_project as insert into public.projects (org_id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Owner Project');
select lives_ok('owner_create_project', 'Owner can create project');
reset role;

-- Test 17: Owner can promote to owner
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
prepare owner_promote_to_owner as update public.org_memberships set role = 'owner' where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '33333333-3333-3333-3333-333333333333';
select lives_ok('owner_promote_to_owner', 'Owner can promote admin to owner');
set role postgres;
update public.org_memberships set role = 'admin' where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '33333333-3333-3333-3333-333333333333';
reset role;

-- Test 18: Admin can manage member/admin roles
set role authenticated;
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
prepare admin_promote_member as update public.org_memberships set role = 'admin' where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '44444444-4444-4444-4444-444444444444';
select lives_ok('admin_promote_member', 'Admin can promote member to admin');
set role postgres;
update public.org_memberships set role = 'member' where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and user_id = '44444444-4444-4444-4444-444444444444';
reset role;

-- ============================================================================
-- CREATE_ORG AND OWNERSHIP TESTS
-- ============================================================================

-- Test 19: create_org makes caller the owner
set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select lives_ok($$select public.create_org('Test Org', 'test-org-pgtap')$$, 'create_org succeeds');
select is((select role from public.org_memberships om join public.orgs o on om.org_id = o.id where o.slug = 'test-org-pgtap' and om.user_id = '22222222-2222-2222-2222-222222222222'), 'owner'::text, 'Caller is owner of created org');
reset role;

-- Test 21-22: Last owner removal is refused by trigger
set role postgres;
select is((select count(*)::int from public.org_memberships where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and role = 'owner'), 1, 'Org B has exactly 1 owner');
reset role;

-- The trigger should prevent this delete
set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select throws_ok(
  $$delete from public.org_memberships where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and user_id = '22222222-2222-2222-2222-222222222222'$$,
  'P0001',
  'Cannot remove the last owner from an organization',
  'Trigger prevents last owner removal'
);
reset role;

-- Test 22: Owner can delete org
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
prepare owner_delete_org as delete from public.orgs where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select lives_ok('owner_delete_org', 'Owner can delete org');
select is((select count(*)::int from public.org_memberships where org_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0, 'Memberships cascade deleted with org');
reset role;

-- ============================================================================
-- ANON ROLE TESTS
-- ============================================================================

-- Test 24-26: anon cannot execute functions
set role anon;
prepare anon_is_org_member as select public.is_org_member('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select throws_ok('anon_is_org_member', '42501', null, 'anon cannot call is_org_member');
prepare anon_has_org_role as select public.has_org_role('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', array['owner']);
select throws_ok('anon_has_org_role', '42501', null, 'anon cannot call has_org_role');
prepare anon_create_org as select public.create_org('Anon Org', 'anon-org');
select throws_ok('anon_create_org', '42501', null, 'anon cannot call create_org');
reset role;

-- Test 27: Authenticated cannot insert into audit_log
set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
prepare auth_insert_audit as insert into public.audit_log (org_id, actor_type, action) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user', 'bad_action');
select throws_ok('auth_insert_audit', '42501', null, 'Authenticated user cannot insert into audit_log');
reset role;

-- Test 28: Member can leave org
set role postgres;
insert into public.org_memberships (org_id, user_id, role) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'member');
reset role;
set role authenticated;
set local "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
prepare member_leave_org as delete from public.org_memberships where org_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and user_id = '44444444-4444-4444-4444-444444444444';
select lives_ok('member_leave_org', 'Member can delete own membership (leave org)');
reset role;

select * from finish();
rollback;
