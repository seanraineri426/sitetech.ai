-- pgTAP tests for migration 0002 (SiteTech data schema)
-- Tests: cross-org isolation, RLS policies, constraints, service role writes

begin;
select plan(68);

-- Setup test data
set role postgres;

-- Create orgs and users first
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

-- Add test projects with timezone
insert into public.projects (id, org_id, name, timezone) values
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Project A1', 'America/New_York'),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Project B1', 'America/Los_Angeles');

insert into public.projects (id, org_id, name, timezone) values
  ('33333333-aaaa-aaaa-aaaa-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Project A2', 'America/New_York'),
  ('44444444-bbbb-bbbb-bbbb-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Project B2', 'America/Los_Angeles');

-- Add integration connections
insert into public.integration_connections (id, org_id, provider, status, display_name, external_account_id) values
  ('11111111-1111-1111-1111-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'procore', 'active', 'Procore Org A', 'procore-a'),
  ('22222222-2222-2222-2222-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'msgraph', 'active', 'Graph Org B', 'graph-b');

-- Add project sources
insert into public.project_sources (id, org_id, project_id, connection_id, source_project_id) values
  ('11111111-1111-1111-1111-000000000011', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', '11111111-1111-1111-1111-000000000001', 'procore-proj-123'),
  ('22222222-2222-2222-2222-000000000022', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-bbbb-bbbb-bbbb-444444444444', '22222222-2222-2222-2222-000000000002', 'graph-proj-456');

-- Add sync runs
insert into public.sync_runs (id, org_id, project_id, project_source_id, kind, status) values
  ('11111111-1111-1111-1111-000000000111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', '11111111-1111-1111-1111-000000000011', 'backfill', 'succeeded'),
  ('22222222-2222-2222-2222-000000000222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-bbbb-bbbb-bbbb-444444444444', '22222222-2222-2222-2222-000000000022', 'incremental', 'succeeded');

-- Add raw records
insert into public.raw_records (id, org_id, project_id, source, entity_type, external_id, allowlisted_payload, fingerprint) values
  ('11111111-1111-1111-1111-000000001111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'procore', 'rfi', 'rfi-1', '{"number":"001"}', 'fp-1'),
  ('22222222-2222-2222-2222-000000002222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-bbbb-bbbb-bbbb-444444444444', 'msgraph', 'email', 'email-1', '{"subject":"Test"}', 'fp-2');

-- Add rfis
insert into public.rfis (id, org_id, project_id, raw_record_id, external_id, number, subject, status) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', '11111111-1111-1111-1111-000000001111', 'rfi-1', '001', 'Test RFI', 'open');

-- Add submittals
insert into public.submittals (id, org_id, project_id, raw_record_id, external_id, number, title, status) values
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-bbbb-bbbb-bbbb-444444444444', '22222222-2222-2222-2222-000000002222', 'sub-1', 'S001', 'Test Submittal', 'pending');

-- Add emails
insert into public.emails (id, org_id, project_id, raw_record_id, external_id, subject, from_address, received_at, received_at_source) values
  ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', '11111111-1111-1111-1111-000000001111', 'email-1', 'Test Email', 'test@example.com', now(), 'graph');

-- Add project notice periods
insert into public.project_notice_periods (id, org_id, project_id, contract_kind, notice_type, days, day_basis) values
  ('44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'owner_gc', 'delay_time_extension', 10, 'calendar');

-- Add project holidays
insert into public.project_holidays (id, org_id, project_id, holiday_date, label) values
  ('55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', '2026-12-25', 'Christmas');

-- Add project parties
insert into public.project_parties (id, org_id, project_id, company_name, email_domain, role) values
  ('66666666-6666-6666-6666-666666666666', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'Owner Company', 'owner.example.com', 'owner');

reset role;

-- ============================================================================
-- CROSS-ORG ISOLATION TESTS
-- ============================================================================

-- Test 1-2: integration_connections
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.integration_connections), 1, 'User in Org A sees only Org A integration connections');
reset role;

set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.integration_connections), 1, 'User in Org B sees only Org B integration connections');
reset role;

-- Test 3-4: project_sources
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.project_sources), 1, 'User in Org A sees only Org A project sources');
reset role;

set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.project_sources), 1, 'User in Org B sees only Org B project sources');
reset role;

-- Test 5-6: sync_runs
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.sync_runs), 1, 'User in Org A sees only Org A sync runs');
reset role;

set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.sync_runs), 1, 'User in Org B sees only Org B sync runs');
reset role;

-- Test 7-8: raw_records
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.raw_records), 1, 'User in Org A sees only Org A raw records');
reset role;

set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.raw_records), 1, 'User in Org B sees only Org B raw records');
reset role;

-- Test 9-10: rfis
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.rfis), 1, 'User in Org A sees only Org A rfis');
reset role;

set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.rfis), 0, 'User in Org B sees only Org B rfis (zero in this case)');
reset role;

-- Test 11-12: submittals
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.submittals), 0, 'User in Org A sees only Org A submittals (zero in this case)');
reset role;

set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.submittals), 1, 'User in Org B sees only Org B submittals');
reset role;

-- Test 13-14: emails
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.emails), 1, 'User in Org A sees only Org A emails');
reset role;

set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.emails), 0, 'User in Org B sees only Org B emails (zero in this case)');
reset role;

-- Test 15-16: project_notice_periods
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.project_notice_periods), 1, 'User in Org A sees only Org A project notice periods');
reset role;

set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.project_notice_periods), 0, 'User in Org B sees only Org B project notice periods (zero in this case)');
reset role;

-- Test 17-18: project_holidays
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.project_holidays), 1, 'User in Org A sees only Org A project holidays');
reset role;

set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.project_holidays), 0, 'User in Org B sees only Org B project holidays (zero in this case)');
reset role;

-- Test 19-20: project_parties
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from public.project_parties), 1, 'User in Org A sees only Org A project parties');
reset role;

set role authenticated;
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.project_parties), 0, 'User in Org B sees only Org B project parties (zero in this case)');
reset role;

-- ============================================================================
-- MEMBER PERMISSIONS TESTS (settings tables)
-- ============================================================================

-- Test 21: Member can read project_notice_periods but cannot insert
set role authenticated;
set local "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
select is((select count(*)::int from public.project_notice_periods), 1, 'Member can read project notice periods');
select throws_ok(
  $$insert into public.project_notice_periods (org_id, project_id, contract_kind, notice_type, days, day_basis) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'owner_gc', 'cost_change_claim', 15, 'calendar')$$,
  '42501',
  null,
  'Member cannot insert project notice periods'
);
reset role;

-- Test 23: Member cannot insert project_holidays
set role authenticated;
set local "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
select throws_ok(
  $$insert into public.project_holidays (org_id, project_id, holiday_date, label) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', '2026-12-31', 'New Year Eve')$$,
  '42501',
  null,
  'Member cannot insert project holidays'
);
reset role;

-- Test 24: Member cannot insert project_parties
set role authenticated;
set local "request.jwt.claim.sub" = '44444444-4444-4444-4444-444444444444';
select throws_ok(
  $$insert into public.project_parties (org_id, project_id, company_name, email_domain, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'Sub Company', 'sub.example.com', 'sub')$$,
  '42501',
  null,
  'Member cannot insert project parties'
);
reset role;

-- ============================================================================
-- ADMIN PERMISSIONS TESTS (settings tables)
-- ============================================================================

-- Test 25: Admin can insert project_notice_periods
set role authenticated;
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
prepare admin_insert_notice as insert into public.project_notice_periods (org_id, project_id, contract_kind, notice_type, days, day_basis) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'owner_gc', 'cost_change_claim', 20, 'business');
select lives_ok('admin_insert_notice', 'Admin can insert project notice periods');
reset role;

-- Test 26: Admin can insert project_holidays
set role authenticated;
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
prepare admin_insert_holiday as insert into public.project_holidays (org_id, project_id, holiday_date, label) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', '2026-07-04', 'Independence Day');
select lives_ok('admin_insert_holiday', 'Admin can insert project holidays');
reset role;

-- Test 27: Admin can insert project_parties
set role authenticated;
set local "request.jwt.claim.sub" = '33333333-3333-3333-3333-333333333333';
prepare admin_insert_party as insert into public.project_parties (org_id, project_id, company_name, email_domain, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'GC Company', 'gc.example.com', 'gc');
select lives_ok('admin_insert_party', 'Admin can insert project parties');
reset role;

-- Test 28: Owner can insert project_notice_periods
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
prepare owner_insert_notice as insert into public.project_notice_periods (org_id, project_id, contract_kind, notice_type, days, day_basis) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'owner_gc', 'cure_default', 5, 'calendar');
select lives_ok('owner_insert_notice', 'Owner can insert project notice periods');
reset role;

-- ============================================================================
-- CONNECTOR DATA TABLES - SERVICE ROLE ONLY
-- ============================================================================

-- Test 29: Authenticated cannot insert sync_runs
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select throws_ok(
  $$insert into public.sync_runs (org_id, project_id, project_source_id, kind, status) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', '11111111-1111-1111-1111-000000000011', 'incremental', 'queued')$$,
  '42501',
  null,
  'Authenticated cannot insert sync_runs'
);
reset role;

-- Test 30: Authenticated cannot insert raw_records
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select throws_ok(
  $$insert into public.raw_records (org_id, project_id, source, entity_type, external_id, allowlisted_payload, fingerprint) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'procore', 'rfi', 'rfi-2', '{}', 'fp-3')$$,
  '42501',
  null,
  'Authenticated cannot insert raw_records'
);
reset role;

-- Test 31: Authenticated cannot insert rfis
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select throws_ok(
  $$insert into public.rfis (org_id, project_id, raw_record_id, external_id, number, subject, status) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', '11111111-1111-1111-1111-000000001111', 'rfi-2', '002', 'Test', 'open')$$,
  '42501',
  null,
  'Authenticated cannot insert rfis'
);
reset role;

-- Test 32: Authenticated cannot insert submittals
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select throws_ok(
  $$insert into public.submittals (org_id, project_id, raw_record_id, external_id, number, title, status) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', '11111111-1111-1111-1111-000000001111', 'sub-2', 'S002', 'Test', 'pending')$$,
  '42501',
  null,
  'Authenticated cannot insert submittals'
);
reset role;

-- Test 33: Authenticated cannot insert emails
set role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
select throws_ok(
  $$insert into public.emails (org_id, project_id, raw_record_id, external_id, subject, from_address, received_at, received_at_source) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', '11111111-1111-1111-1111-000000001111', 'email-2', 'Test', 'test@example.com', now(), 'graph')$$,
  '42501',
  null,
  'Authenticated cannot insert emails'
);
reset role;

-- ============================================================================
-- ANON ROLE TESTS
-- ============================================================================

-- Test 34-43: Anon cannot see any new tables
set role anon;
select is((select count(*)::int from public.integration_connections), 0, 'Anon cannot see integration_connections');
select is((select count(*)::int from public.project_sources), 0, 'Anon cannot see project_sources');
select is((select count(*)::int from public.sync_runs), 0, 'Anon cannot see sync_runs');
select is((select count(*)::int from public.raw_records), 0, 'Anon cannot see raw_records');
select is((select count(*)::int from public.rfis), 0, 'Anon cannot see rfis');
select is((select count(*)::int from public.submittals), 0, 'Anon cannot see submittals');
select is((select count(*)::int from public.emails), 0, 'Anon cannot see emails');
select is((select count(*)::int from public.project_notice_periods), 0, 'Anon cannot see project_notice_periods');
select is((select count(*)::int from public.project_holidays), 0, 'Anon cannot see project_holidays');
select is((select count(*)::int from public.project_parties), 0, 'Anon cannot see project_parties');
reset role;

-- ============================================================================
-- CONSTRAINT TESTS
-- ============================================================================

-- Test 44: project_id from another org is rejected (project_sources)
set role postgres;
select throws_ok(
  $$insert into public.project_sources (org_id, project_id, connection_id, source_project_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-bbbb-bbbb-bbbb-444444444444', '11111111-1111-1111-1111-000000000001', 'wrong-org-proj')$$,
  '23503',
  null,
  'project_id from another org rejected (project_sources)'
);
reset role;

-- Test 45: project_id from another org is rejected (sync_runs)
set role postgres;
select throws_ok(
  $$insert into public.sync_runs (org_id, project_id, project_source_id, kind, status) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-bbbb-bbbb-bbbb-444444444444', '11111111-1111-1111-1111-000000000011', 'backfill', 'queued')$$,
  '23503',
  null,
  'project_id from another org rejected (sync_runs)'
);
reset role;

-- Test 46: project_id from another org is rejected (raw_records)
set role postgres;
select throws_ok(
  $$insert into public.raw_records (org_id, project_id, source, entity_type, external_id, allowlisted_payload, fingerprint) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-bbbb-bbbb-bbbb-444444444444', 'procore', 'rfi', 'wrong', '{}', 'fp')$$,
  '23503',
  null,
  'project_id from another org rejected (raw_records)'
);
reset role;

-- Test 47: project_id from another org is rejected (project_notice_periods)
set role postgres;
select throws_ok(
  $$insert into public.project_notice_periods (org_id, project_id, contract_kind, notice_type, days, day_basis) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-bbbb-bbbb-bbbb-444444444444', 'owner_gc', 'delay_time_extension', 10, 'calendar')$$,
  '23503',
  null,
  'project_id from another org rejected (project_notice_periods)'
);
reset role;

-- Test 48: notice_type enum matches exactly 7 values
set role postgres;
select is(
  (select count(*)::int from pg_enum where enumtypid = 'public.notice_type'::regtype),
  7,
  'notice_type enum has exactly 7 values'
);

-- Verify each notice_type value
select ok(
  (select enumlabel::text from pg_enum where enumtypid = 'public.notice_type'::regtype and enumlabel = 'delay_time_extension') is not null,
  'notice_type includes delay_time_extension'
);
select ok(
  (select enumlabel::text from pg_enum where enumtypid = 'public.notice_type'::regtype and enumlabel = 'cost_change_claim') is not null,
  'notice_type includes cost_change_claim'
);
select ok(
  (select enumlabel::text from pg_enum where enumtypid = 'public.notice_type'::regtype and enumlabel = 'differing_site_condition') is not null,
  'notice_type includes differing_site_condition'
);
select ok(
  (select enumlabel::text from pg_enum where enumtypid = 'public.notice_type'::regtype and enumlabel = 'change_directive_dispute') is not null,
  'notice_type includes change_directive_dispute'
);
select ok(
  (select enumlabel::text from pg_enum where enumtypid = 'public.notice_type'::regtype and enumlabel = 'cure_default') is not null,
  'notice_type includes cure_default'
);
select ok(
  (select enumlabel::text from pg_enum where enumtypid = 'public.notice_type'::regtype and enumlabel = 'injury_property_damage') is not null,
  'notice_type includes injury_property_damage'
);
select ok(
  (select enumlabel::text from pg_enum where enumtypid = 'public.notice_type'::regtype and enumlabel = 'other') is not null,
  'notice_type includes other'
);
reset role;

-- Test 56: gc_sub without counterparty rejected
set role postgres;
select throws_ok(
  $$insert into public.project_notice_periods (org_id, project_id, contract_kind, counterparty_name, notice_type, days, day_basis) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'gc_sub', null, 'delay_time_extension', 10, 'calendar')$$,
  '23514',
  null,
  'gc_sub without counterparty rejected'
);
reset role;

-- Test 57: owner_gc can have null counterparty
set role postgres;
prepare owner_gc_null_counterparty as insert into public.project_notice_periods (org_id, project_id, contract_kind, counterparty_name, notice_type, days, day_basis) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'owner_gc', null, 'injury_property_damage', 3, 'calendar');
select lives_ok('owner_gc_null_counterparty', 'owner_gc can have null counterparty');
reset role;

-- Test 58: days <= 0 rejected
set role postgres;
select throws_ok(
  $$insert into public.project_notice_periods (org_id, project_id, contract_kind, notice_type, days, day_basis) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'owner_gc', 'delay_time_extension', 0, 'calendar')$$,
  '23514',
  null,
  'days <= 0 rejected (zero)'
);
reset role;

-- Test 59: days <= 0 rejected (negative)
set role postgres;
select throws_ok(
  $$insert into public.project_notice_periods (org_id, project_id, contract_kind, notice_type, days, day_basis) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'owner_gc', 'delay_time_extension', -5, 'calendar')$$,
  '23514',
  null,
  'days <= 0 rejected (negative)'
);
reset role;

-- Test 60: email_domain uniqueness per project enforced
set role postgres;
select throws_ok(
  $$insert into public.project_parties (org_id, project_id, company_name, email_domain, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'Another Owner', 'owner.example.com', 'owner')$$,
  '23505',
  null,
  'email_domain uniqueness per project enforced'
);
reset role;

-- Test 61: email_domain must be lowercase
set role postgres;
select throws_ok(
  $$insert into public.project_parties (org_id, project_id, company_name, email_domain, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'Test Company', 'TEST.example.com', 'sub')$$,
  '23514',
  null,
  'email_domain must be lowercase'
);
reset role;

-- Test 62: email_domain from another project is allowed (same org)
set role postgres;
prepare domain_diff_project as insert into public.project_parties (org_id, project_id, company_name, email_domain, role) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-aaaa-aaaa-aaaa-111111111111', 'Owner Company', 'owner.example.com', 'owner');
select lives_ok('domain_diff_project', 'email_domain from another project is allowed (same org)');
reset role;

-- Test 63: raw_records unique key enforced
set role postgres;
select throws_ok(
  $$insert into public.raw_records (org_id, project_id, source, entity_type, external_id, allowlisted_payload, fingerprint) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'procore', 'rfi', 'rfi-1', '{}', 'fp-new')$$,
  '23505',
  null,
  'raw_records unique key enforced (org_id, project_id, source, entity_type, external_id)'
);
reset role;

-- Test 64: raw_records with same external_id but different entity_type is allowed
set role postgres;
prepare raw_diff_entity as insert into public.raw_records (org_id, project_id, source, entity_type, external_id, allowlisted_payload, fingerprint) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', 'procore', 'submittal', 'rfi-1', '{}', 'fp-new');
select lives_ok('raw_diff_entity', 'raw_records with same external_id but different entity_type is allowed');
reset role;

-- Test 65: project_holidays unique date per project enforced
set role postgres;
select throws_ok(
  $$insert into public.project_holidays (org_id, project_id, holiday_date, label) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-aaaa-aaaa-aaaa-333333333333', '2026-12-25', 'Christmas (duplicate)')$$,
  '23505',
  null,
  'project_holidays unique date per project enforced'
);
reset role;

-- Test 66: project_holidays same date in different project is allowed
set role postgres;
prepare holiday_diff_project as insert into public.project_holidays (org_id, project_id, holiday_date, label) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-aaaa-aaaa-aaaa-111111111111', '2026-12-25', 'Christmas');
select lives_ok('holiday_diff_project', 'project_holidays same date in different project is allowed');
reset role;

-- Test 67: integration_connections unique constraint enforced
set role postgres;
select throws_ok(
  $$insert into public.integration_connections (org_id, provider, status, display_name, external_account_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'procore', 'active', 'Duplicate', 'procore-a')$$,
  '23505',
  null,
  'integration_connections unique (org_id, provider, external_account_id) enforced'
);
reset role;

-- Test 68: integration_connections same external_account_id in different org is allowed
set role postgres;
prepare conn_diff_org as insert into public.integration_connections (org_id, provider, status, display_name, external_account_id) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'procore', 'active', 'Procore Org B', 'procore-a');
select lives_ok('conn_diff_org', 'integration_connections same external_account_id in different org is allowed');
reset role;

select * from finish();
rollback;
