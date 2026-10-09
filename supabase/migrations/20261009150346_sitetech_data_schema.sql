-- Migration 0002: SiteTech construction data schema
-- Creates: projects extensions, integration_connections, project_sources, sync_runs,
-- raw_records, rfis, submittals, emails, project_notice_periods, project_holidays, project_parties
-- Follows: multi-tenant conventions from migration 0001

-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.integration_provider as enum ('procore', 'msgraph', 'p6_upload');
create type public.connection_status as enum ('pending', 'active', 'error', 'disconnected');
create type public.sync_kind as enum ('backfill', 'incremental', 'reconcile', 'purge');
create type public.sync_status as enum ('queued', 'running', 'succeeded', 'failed', 'partial');
create type public.received_at_source as enum ('graph', 'forwarded_text');
create type public.contract_kind as enum ('owner_gc', 'gc_sub');
create type public.notice_type as enum ('delay_time_extension', 'cost_change_claim', 'differing_site_condition', 'change_directive_dispute', 'cure_default', 'injury_property_damage', 'other');
create type public.day_basis as enum ('calendar', 'business');
create type public.company_role as enum ('owner', 'architect_engineer', 'gc', 'sub');
create type public.schedule_match_method as enum ('task_code', 'name_spec', 'manual');

-- ============================================================================
-- EXTEND PROJECTS TABLE
-- ============================================================================

-- Add daily_delay_cost_usd column (timezone already exists from migration 0001)
alter table public.projects add column daily_delay_cost_usd numeric null;

-- ============================================================================
-- CROSS-ORG INTEGRITY CONSTRAINT SETUP
-- ============================================================================

-- Add unique constraint on projects (id, org_id) for composite FK references
create unique index projects_id_org_id_key on public.projects(id, org_id);

-- ============================================================================
-- INTEGRATION CONNECTIONS TABLE
-- ============================================================================

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  provider public.integration_provider not null,
  status public.connection_status not null default 'pending',
  display_name text not null,
  external_account_id text not null,
  vault_secret_id uuid null,
  disconnected_at timestamptz null,
  created_by uuid references public.profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_connections_unique_provider unique (org_id, provider, external_account_id)
);

comment on table public.integration_connections is 'External system connections (Procore, MS Graph, P6)';
comment on column public.integration_connections.vault_secret_id is 'Pointer to Supabase Vault; never store tokens in plain columns';

-- ============================================================================
-- PROJECT SOURCES TABLE
-- ============================================================================

create table public.project_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  connection_id uuid not null references public.integration_connections on delete cascade,
  source_project_id text not null,
  source_company_id text null,
  mailbox text null,
  site_id text null,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_sources_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id),
  constraint project_sources_unique_source unique (org_id, project_id, connection_id, source_project_id)
);

comment on table public.project_sources is 'Maps projects to external system sources';

-- ============================================================================
-- SYNC RUNS TABLE
-- ============================================================================

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  project_source_id uuid not null references public.project_sources on delete cascade,
  kind public.sync_kind not null,
  status public.sync_status not null default 'queued',
  started_at timestamptz null,
  finished_at timestamptz null,
  checkpoint jsonb null,
  counts jsonb null,
  error_code text null,
  error_summary text null,
  created_at timestamptz not null default now(),
  constraint sync_runs_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id)
);

comment on table public.sync_runs is 'Sync job runs (service role writes only)';
comment on column public.sync_runs.error_summary is 'Human-readable error; no raw response bodies';

-- ============================================================================
-- RAW RECORDS TABLE
-- ============================================================================

create table public.raw_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  source text not null,
  entity_type text not null,
  external_id text not null,
  allowlisted_payload jsonb not null,
  fingerprint text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint raw_records_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id),
  constraint raw_records_unique_entity unique (org_id, project_id, source, entity_type, external_id)
);

comment on table public.raw_records is 'Allowlisted API data only; never full responses or attachments (service role writes only)';

-- ============================================================================
-- RFIS TABLE
-- ============================================================================

create table public.rfis (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  raw_record_id uuid not null references public.raw_records on delete cascade,
  external_id text not null,
  number text not null,
  subject text not null,
  status text not null,
  question text null,
  answer text null,
  due_date date null,
  initiated_date date null,
  closed_date date null,
  location text null,
  cost_code text null,
  assignees jsonb null,
  responsible_contractor jsonb null,
  schedule_impact_status text null,
  schedule_impact_days numeric null,
  cost_impact_status text null,
  cost_impact_amount numeric null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rfis_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id),
  constraint rfis_unique_external unique (org_id, project_id, external_id)
);

comment on table public.rfis is 'Request for Information entities (service role writes only)';
comment on column public.rfis.assignees is 'Array of {id,name}, NO emails';

-- ============================================================================
-- SUBMITTALS TABLE
-- ============================================================================

create table public.submittals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  raw_record_id uuid not null references public.raw_records on delete cascade,
  external_id text not null,
  number text not null,
  title text not null,
  status text not null,
  spec_section text null,
  scheduled_task jsonb null,
  schedule_activity_id uuid null,
  schedule_match_method public.schedule_match_method null,
  schedule_match_confidence numeric null,
  required_on_site_date date null,
  lead_time_days int null,
  review_time_days int null,
  buffer_time_days int null,
  received_date date null,
  due_date date null,
  current_revision int null,
  approver_responses jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submittals_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id),
  constraint submittals_unique_external unique (org_id, project_id, external_id),
  constraint submittals_confidence_range check (schedule_match_confidence is null or (schedule_match_confidence >= 0 and schedule_match_confidence <= 1)),
  constraint submittals_activity_requires_method check (schedule_activity_id is null or schedule_match_method is not null),
  constraint submittals_name_spec_requires_confidence check (schedule_match_method != 'name_spec' or schedule_match_confidence is not null)
);

comment on table public.submittals is 'Submittal entities (service role writes only)';
comment on column public.submittals.approver_responses is 'Per-revision array of {revision, approver {id,name}, response, responded_at}, no emails';
comment on column public.submittals.scheduled_task is 'JSONB with {id, name, code} where code is possible P6 activity code (not personal data)';
comment on column public.submittals.schedule_activity_id is 'Join key to schedule_activities for comparing vendor dates to activity dates and float';
comment on column public.submittals.schedule_match_method is 'How the schedule activity was matched: task_code (exact), name_spec (fuzzy), or manual';
comment on column public.submittals.schedule_match_confidence is 'Match confidence 0-1; required for name_spec, optional for task_code/manual; rules apply dollar exposure only when method is task_code or manual';

-- ============================================================================
-- EMAILS TABLE
-- ============================================================================

create table public.emails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  raw_record_id uuid not null references public.raw_records on delete cascade,
  external_id text not null,
  conversation_id text null,
  subject text not null,
  from_address text not null,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  received_at timestamptz not null,
  received_at_source public.received_at_source not null,
  body_preview text null,
  has_attachments boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emails_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id),
  constraint emails_unique_external unique (org_id, project_id, external_id)
);

comment on table public.emails is 'Email entities; addresses stored only here under RLS and 30-day purge (service role writes only)';

-- ============================================================================
-- SCHEDULE ACTIVITIES TABLE
-- ============================================================================

create table public.schedule_activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  raw_record_id uuid null references public.raw_records on delete set null,
  external_id text not null,
  task_id text null,
  task_code text not null,
  name text not null,
  wbs_path text null,
  early_start date null,
  early_finish date null,
  late_start date null,
  late_finish date null,
  baseline_start date null,
  baseline_finish date null,
  total_float_days numeric null,
  free_float_days numeric null,
  status text null,
  predecessors text[] not null default '{}',
  import_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_activities_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id),
  constraint schedule_activities_unique_external unique (org_id, project_id, external_id)
);

comment on table public.schedule_activities is 'P6 XER schedule activities (service role writes only)';
comment on column public.schedule_activities.external_id is 'Format: {proj_short_name}:{task_code}';
comment on column public.schedule_activities.task_id is 'P6 internal ID, secondary only';

-- Add foreign key from submittals to schedule_activities (must be after schedule_activities is created)
alter table public.submittals add constraint submittals_schedule_activity_id_fkey 
  foreign key (schedule_activity_id) references public.schedule_activities(id) on delete set null;

-- ============================================================================
-- PROJECT NOTICE PERIODS TABLE (settings)
-- ============================================================================

create table public.project_notice_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  contract_kind public.contract_kind not null,
  counterparty_name text null,
  notice_type public.notice_type not null,
  days int not null,
  day_basis public.day_basis not null,
  contract_section text null,
  entered_by uuid references public.profiles,
  entered_at timestamptz not null default now(),
  constraint project_notice_periods_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id),
  constraint project_notice_periods_days_positive check (days > 0),
  constraint project_notice_periods_gc_sub_requires_counterparty check (
    contract_kind != 'gc_sub' or counterparty_name is not null
  )
);

comment on table public.project_notice_periods is 'Contractual notice periods by project (owner/admin writes only)';

-- ============================================================================
-- PROJECT HOLIDAYS TABLE (settings)
-- ============================================================================

create table public.project_holidays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  holiday_date date not null,
  label text not null,
  created_at timestamptz not null default now(),
  constraint project_holidays_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id),
  constraint project_holidays_unique_date unique (org_id, project_id, holiday_date)
);

comment on table public.project_holidays is 'Project-specific holidays (owner/admin writes only)';

-- ============================================================================
-- PROJECT PARTIES TABLE (settings)
-- ============================================================================

create table public.project_parties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  project_id uuid not null,
  company_name text not null,
  email_domain text not null,
  role public.company_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_parties_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id),
  constraint project_parties_unique_domain unique (org_id, project_id, email_domain),
  constraint project_parties_email_domain_lowercase check (email_domain = lower(email_domain)),
  constraint project_parties_email_domain_nonempty check (char_length(email_domain) > 0)
);

comment on table public.project_parties is 'Project companies and email domains (owner/admin writes only)';

-- ============================================================================
-- INDEXES
-- ============================================================================

create index idx_integration_connections_org_id on public.integration_connections(org_id);

create index idx_project_sources_org_project on public.project_sources(org_id, project_id);
create index idx_project_sources_connection_id on public.project_sources(connection_id);

create index idx_sync_runs_org_project on public.sync_runs(org_id, project_id);
create index idx_sync_runs_source_id on public.sync_runs(project_source_id);
create index idx_sync_runs_status on public.sync_runs(status);

create index idx_raw_records_org_project on public.raw_records(org_id, project_id);
create index idx_raw_records_fingerprint on public.raw_records(fingerprint);
create index idx_raw_records_external_lookup on public.raw_records(org_id, project_id, source, entity_type, external_id);

create index idx_rfis_org_project on public.rfis(org_id, project_id);
create index idx_rfis_external_lookup on public.rfis(org_id, project_id, external_id);

create index idx_submittals_org_project on public.submittals(org_id, project_id);
create index idx_submittals_external_lookup on public.submittals(org_id, project_id, external_id);

create index idx_emails_org_project on public.emails(org_id, project_id);
create index idx_emails_external_lookup on public.emails(org_id, project_id, external_id);
create index idx_emails_received_at on public.emails(received_at);

create index idx_schedule_activities_org_project on public.schedule_activities(org_id, project_id);
create index idx_schedule_activities_early_start on public.schedule_activities(org_id, project_id, early_start);
create index idx_schedule_activities_external_lookup on public.schedule_activities(org_id, project_id, external_id);

create index idx_project_notice_periods_org_project on public.project_notice_periods(org_id, project_id);

create index idx_project_holidays_org_project on public.project_holidays(org_id, project_id);

create index idx_project_parties_org_project on public.project_parties(org_id, project_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.integration_connections enable row level security;
alter table public.project_sources enable row level security;
alter table public.sync_runs enable row level security;
alter table public.raw_records enable row level security;
alter table public.rfis enable row level security;
alter table public.submittals enable row level security;
alter table public.emails enable row level security;
alter table public.schedule_activities enable row level security;
alter table public.project_notice_periods enable row level security;
alter table public.project_holidays enable row level security;
alter table public.project_parties enable row level security;

-- ============================================================================
-- RLS POLICIES: integration_connections
-- ============================================================================

create policy "Org members can view integration connections"
  on public.integration_connections for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "Owners and admins can insert integration connections"
  on public.integration_connections for insert
  to authenticated
  with check (public.has_org_role(org_id, array['owner', 'admin']));

create policy "Owners and admins can update integration connections"
  on public.integration_connections for update
  to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']))
  with check (public.has_org_role(org_id, array['owner', 'admin']));

create policy "Owners and admins can delete integration connections"
  on public.integration_connections for delete
  to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']));

-- ============================================================================
-- RLS POLICIES: project_sources
-- ============================================================================

create policy "Org members can view project sources"
  on public.project_sources for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "Owners and admins can insert project sources"
  on public.project_sources for insert
  to authenticated
  with check (public.has_org_role(org_id, array['owner', 'admin']));

create policy "Owners and admins can update project sources"
  on public.project_sources for update
  to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']))
  with check (public.has_org_role(org_id, array['owner', 'admin']));

create policy "Owners and admins can delete project sources"
  on public.project_sources for delete
  to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']));

-- ============================================================================
-- RLS POLICIES: sync_runs (service role writes only)
-- ============================================================================

create policy "Org members can view sync runs"
  on public.sync_runs for select
  to authenticated
  using (public.is_org_member(org_id));

-- No insert/update/delete policies for authenticated - service role only

-- ============================================================================
-- RLS POLICIES: raw_records (service role writes only)
-- ============================================================================

create policy "Org members can view raw records"
  on public.raw_records for select
  to authenticated
  using (public.is_org_member(org_id));

-- No insert/update/delete policies for authenticated - service role only

-- ============================================================================
-- RLS POLICIES: rfis (service role writes only)
-- ============================================================================

create policy "Org members can view rfis"
  on public.rfis for select
  to authenticated
  using (public.is_org_member(org_id));

-- No insert/update/delete policies for authenticated - service role only

-- ============================================================================
-- RLS POLICIES: submittals (service role writes only)
-- ============================================================================

create policy "Org members can view submittals"
  on public.submittals for select
  to authenticated
  using (public.is_org_member(org_id));

-- No insert/update/delete policies for authenticated - service role only

-- ============================================================================
-- RLS POLICIES: emails (service role writes only)
-- ============================================================================

create policy "Org members can view emails"
  on public.emails for select
  to authenticated
  using (public.is_org_member(org_id));

-- No insert/update/delete policies for authenticated - service role only

-- ============================================================================
-- RLS POLICIES: schedule_activities (service role writes only)
-- ============================================================================

create policy "Org members can view schedule activities"
  on public.schedule_activities for select
  to authenticated
  using (public.is_org_member(org_id));

-- No insert/update/delete policies for authenticated - service role only

-- ============================================================================
-- RLS POLICIES: project_notice_periods (settings, owner/admin writes)
-- ============================================================================

create policy "Org members can view project notice periods"
  on public.project_notice_periods for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "Owners and admins can insert project notice periods"
  on public.project_notice_periods for insert
  to authenticated
  with check (public.has_org_role(org_id, array['owner', 'admin']));

create policy "Owners and admins can update project notice periods"
  on public.project_notice_periods for update
  to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']))
  with check (public.has_org_role(org_id, array['owner', 'admin']));

create policy "Owners and admins can delete project notice periods"
  on public.project_notice_periods for delete
  to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']));

-- ============================================================================
-- RLS POLICIES: project_holidays (settings, owner/admin writes)
-- ============================================================================

create policy "Org members can view project holidays"
  on public.project_holidays for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "Owners and admins can insert project holidays"
  on public.project_holidays for insert
  to authenticated
  with check (public.has_org_role(org_id, array['owner', 'admin']));

create policy "Owners and admins can update project holidays"
  on public.project_holidays for update
  to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']))
  with check (public.has_org_role(org_id, array['owner', 'admin']));

create policy "Owners and admins can delete project holidays"
  on public.project_holidays for delete
  to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']));

-- ============================================================================
-- RLS POLICIES: project_parties (settings, owner/admin writes)
-- ============================================================================

create policy "Org members can view project parties"
  on public.project_parties for select
  to authenticated
  using (public.is_org_member(org_id));

create policy "Owners and admins can insert project parties"
  on public.project_parties for insert
  to authenticated
  with check (public.has_org_role(org_id, array['owner', 'admin']));

create policy "Owners and admins can update project parties"
  on public.project_parties for update
  to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']))
  with check (public.has_org_role(org_id, array['owner', 'admin']));

create policy "Owners and admins can delete project parties"
  on public.project_parties for delete
  to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']));

-- ============================================================================
-- REVOKE FROM PUBLIC AND ANON
-- ============================================================================

-- Revoke write access from anon; authenticated gets filtered via RLS
revoke insert, update, delete on public.integration_connections from anon;
revoke insert, update, delete on public.project_sources from anon;
revoke insert, update, delete on public.sync_runs from anon;
revoke insert, update, delete on public.raw_records from anon;
revoke insert, update, delete on public.rfis from anon;
revoke insert, update, delete on public.submittals from anon;
revoke insert, update, delete on public.emails from anon;
revoke insert, update, delete on public.schedule_activities from anon;
revoke insert, update, delete on public.project_notice_periods from anon;
revoke insert, update, delete on public.project_holidays from anon;
revoke insert, update, delete on public.project_parties from anon;
