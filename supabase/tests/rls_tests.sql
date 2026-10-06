-- RLS Test Suite
-- Manual tests to verify row-level security policies
-- Run these tests as different users to verify isolation

-- ============================================================================
-- TEST SETUP HELPERS
-- ============================================================================

-- Create test users and orgs
-- Note: These should be run by a privileged user (service_role)
-- In practice, use Supabase service role key or run via pnpm supabase db test

-- ============================================================================
-- TEST 1: Users in different orgs cannot see each other's data
-- ============================================================================

-- Setup: Create two orgs and two users (run as service_role)
-- insert into auth.users (id, email) values 
--   ('11111111-1111-1111-1111-111111111111', 'user1@test.com'),
--   ('22222222-2222-2222-2222-222222222222', 'user2@test.com');
--
-- insert into public.orgs (id, name, slug) values
--   ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Org A', 'org-a'),
--   ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Org B', 'org-b');
--
-- insert into public.org_memberships (org_id, user_id, role) values
--   ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
--   ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');
--
-- insert into public.projects (org_id, name) values
--   ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Project A1'),
--   ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Project B1');

-- TEST: User in org A should only see org A's data
-- set local role authenticated;
-- set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';
-- select count(*) = 1 as "User A sees only Org A" from public.orgs;
-- select count(*) = 1 as "User A sees only Project A1" from public.projects;

-- TEST: User in org B should only see org B's data  
-- set local role authenticated;
-- set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222"}';
-- select count(*) = 1 as "User B sees only Org B" from public.orgs;
-- select count(*) = 1 as "User B sees only Project B1" from public.projects;

-- ============================================================================
-- TEST 2: Role-based permissions work correctly
-- ============================================================================

-- Setup: Create org with owner, admin, and member
-- insert into auth.users (id, email) values 
--   ('33333333-3333-3333-3333-333333333333', 'owner@test.com'),
--   ('44444444-4444-4444-4444-444444444444', 'admin@test.com'),
--   ('55555555-5555-5555-5555-555555555555', 'member@test.com');
--
-- insert into public.orgs (id, name, slug) values
--   ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Org C', 'org-c');
--
-- insert into public.org_memberships (org_id, user_id, role) values
--   ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'owner'),
--   ('cccccccc-cccc-cccc-cccc-cccccccccccc', '44444444-4444-4444-4444-444444444444', 'admin'),
--   ('cccccccc-cccc-cccc-cccc-cccccccccccc', '55555555-5555-5555-5555-555555555555', 'member');

-- TEST: Member cannot update org (should fail)
-- set local role authenticated;
-- set local request.jwt.claims to '{"sub": "55555555-5555-5555-5555-555555555555"}';
-- update public.orgs set name = 'Updated Name' 
-- where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
-- Expected: 0 rows updated (policy prevents it)

-- TEST: Admin can update org (should succeed)
-- set local role authenticated;
-- set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444"}';
-- update public.orgs set name = 'Admin Updated' 
-- where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
-- Expected: 1 row updated

-- TEST: Owner can update org (should succeed)
-- set local role authenticated;
-- set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333"}';
-- update public.orgs set name = 'Owner Updated' 
-- where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
-- Expected: 1 row updated

-- ============================================================================
-- TEST 3: Projects are isolated by org
-- ============================================================================

-- Setup: Two orgs with same project name
-- insert into public.projects (org_id, name) values
--   ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Main Building'),
--   ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Main Building');

-- TEST: User in Org A should only see their "Main Building"
-- set local role authenticated;
-- set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';
-- select count(*) = 1 as "User A sees 1 Main Building", 
--        min(org_id::text) = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' as "Project belongs to Org A"
-- from public.projects 
-- where name = 'Main Building';

-- ============================================================================
-- AUTOMATED TEST FUNCTIONS
-- ============================================================================

-- Helper to test as a specific user
create or replace function test_as_user(user_id uuid, test_query text)
returns jsonb
language plpgsql
security definer
as $$
declare
  result jsonb;
begin
  execute format('set local role authenticated');
  execute format('set local request.jwt.claims to ''{"sub": "%s"}''', user_id);
  execute test_query into result;
  return result;
end;
$$;

comment on function test_as_user(uuid, text) is 'Helper function to run test queries as a specific user for RLS testing';

-- ============================================================================
-- INSTRUCTIONS
-- ============================================================================

-- To run these tests manually:
-- 1. Start local Supabase: pnpm supabase start
-- 2. Reset DB with migrations: pnpm supabase db reset
-- 3. Connect to DB: pnpm supabase db connect
-- 4. Run test setup commands (inserts above) as service_role
-- 5. Run test queries with set role/jwt.claims
--
-- For automated testing, see ../tests/supabase-rls.test.ts
