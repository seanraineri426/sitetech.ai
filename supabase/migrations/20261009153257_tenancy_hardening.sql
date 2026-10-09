-- Migration 0003: Tenancy hardening (fixes cross-org FK leak in 0002)
-- Applies composite FK constraints with org_id to prevent cross-org data leaks
-- Adds proper cascade deletes, privilege revocations, checks, and indexes

begin;

-- ============================================================================
-- 1. ADD UNIQUE CONSTRAINTS for composite FK references
-- ============================================================================

-- These allow other tables to reference (id, org_id) or (id, org_id, project_id)
create unique index if not exists integration_connections_id_org_key on public.integration_connections(id, org_id);
create unique index if not exists project_sources_id_org_project_key on public.project_sources(id, org_id, project_id);
create unique index if not exists raw_records_id_org_project_key on public.raw_records(id, org_id, project_id);
create unique index if not exists schedule_activities_id_org_project_key on public.schedule_activities(id, org_id, project_id);

-- ============================================================================
-- 2. ADD MISSING org_id FOREIGN KEYS with ON DELETE CASCADE
-- ============================================================================

-- Every table must have direct org_id FK for proper cascade on org deletion
alter table public.project_sources add constraint project_sources_org_fk foreign key (org_id) references public.orgs(id) on delete cascade;
alter table public.sync_runs add constraint sync_runs_org_fk foreign key (org_id) references public.orgs(id) on delete cascade;
alter table public.raw_records add constraint raw_records_org_fk foreign key (org_id) references public.orgs(id) on delete cascade;
alter table public.rfis add constraint rfis_org_fk foreign key (org_id) references public.orgs(id) on delete cascade;
alter table public.submittals add constraint submittals_org_fk foreign key (org_id) references public.orgs(id) on delete cascade;
alter table public.emails add constraint emails_org_fk foreign key (org_id) references public.orgs(id) on delete cascade;
alter table public.schedule_activities add constraint schedule_activities_org_fk foreign key (org_id) references public.orgs(id) on delete cascade;
alter table public.project_notice_periods add constraint project_notice_periods_org_fk foreign key (org_id) references public.orgs(id) on delete cascade;
alter table public.project_holidays add constraint project_holidays_org_fk foreign key (org_id) references public.orgs(id) on delete cascade;
alter table public.project_parties add constraint project_parties_org_fk foreign key (org_id) references public.orgs(id) on delete cascade;

-- ============================================================================
-- 3. FIX COMPOSITE PROJECT FKs - add ON DELETE CASCADE
-- ============================================================================

-- Drop and recreate with proper cascade
alter table public.project_sources drop constraint project_sources_org_project_fk;
alter table public.project_sources add constraint project_sources_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id) on delete cascade;

alter table public.sync_runs drop constraint sync_runs_org_project_fk;
alter table public.sync_runs add constraint sync_runs_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id) on delete cascade;

alter table public.raw_records drop constraint raw_records_org_project_fk;
alter table public.raw_records add constraint raw_records_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id) on delete cascade;

alter table public.rfis drop constraint rfis_org_project_fk;
alter table public.rfis add constraint rfis_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id) on delete cascade;

alter table public.submittals drop constraint submittals_org_project_fk;
alter table public.submittals add constraint submittals_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id) on delete cascade;

alter table public.emails drop constraint emails_org_project_fk;
alter table public.emails add constraint emails_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id) on delete cascade;

alter table public.schedule_activities drop constraint schedule_activities_org_project_fk;
alter table public.schedule_activities add constraint schedule_activities_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id) on delete cascade;

alter table public.project_notice_periods drop constraint project_notice_periods_org_project_fk;
alter table public.project_notice_periods add constraint project_notice_periods_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id) on delete cascade;

alter table public.project_holidays drop constraint project_holidays_org_project_fk;
alter table public.project_holidays add constraint project_holidays_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id) on delete cascade;

alter table public.project_parties drop constraint project_parties_org_project_fk;
alter table public.project_parties add constraint project_parties_org_project_fk foreign key (project_id, org_id) references public.projects(id, org_id) on delete cascade;

-- ============================================================================
-- 4. FIX CROSS-TABLE FKs - make them composite with org_id and project_id
-- ============================================================================

-- project_sources.connection_id -> integration_connections
alter table public.project_sources drop constraint project_sources_connection_id_fkey;
alter table public.project_sources add constraint project_sources_connection_fk 
  foreign key (connection_id, org_id) references public.integration_connections(id, org_id);

-- sync_runs.project_source_id -> project_sources
alter table public.sync_runs drop constraint sync_runs_project_source_id_fkey;
alter table public.sync_runs add constraint sync_runs_project_source_fk 
  foreign key (project_source_id, org_id, project_id) references public.project_sources(id, org_id, project_id);

-- rfis.raw_record_id -> raw_records
alter table public.rfis drop constraint rfis_raw_record_id_fkey;
alter table public.rfis add constraint rfis_raw_record_fk 
  foreign key (raw_record_id, org_id, project_id) references public.raw_records(id, org_id, project_id) on delete cascade;

-- submittals.raw_record_id -> raw_records
alter table public.submittals drop constraint submittals_raw_record_id_fkey;
alter table public.submittals add constraint submittals_raw_record_fk 
  foreign key (raw_record_id, org_id, project_id) references public.raw_records(id, org_id, project_id) on delete cascade;

-- emails.raw_record_id -> raw_records  
alter table public.emails drop constraint emails_raw_record_id_fkey;
alter table public.emails add constraint emails_raw_record_fk 
  foreign key (raw_record_id, org_id, project_id) references public.raw_records(id, org_id, project_id) on delete cascade;

-- schedule_activities.raw_record_id -> raw_records (nullable)
alter table public.schedule_activities drop constraint schedule_activities_raw_record_id_fkey;
alter table public.schedule_activities add constraint schedule_activities_raw_record_fk 
  foreign key (raw_record_id, org_id, project_id) references public.raw_records(id, org_id, project_id) on delete set null;

-- submittals.schedule_activity_id -> schedule_activities
alter table public.submittals drop constraint submittals_schedule_activity_id_fkey;
alter table public.submittals add constraint submittals_schedule_activity_fk 
  foreign key (schedule_activity_id, org_id, project_id) references public.schedule_activities(id, org_id, project_id) on delete set null (schedule_activity_id);

-- ============================================================================
-- 5. FIX created_by / entered_by FKs - add ON DELETE SET NULL
-- ============================================================================

alter table public.integration_connections drop constraint integration_connections_created_by_fkey;
alter table public.integration_connections add constraint integration_connections_created_by_fkey 
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.project_notice_periods drop constraint project_notice_periods_entered_by_fkey;
alter table public.project_notice_periods add constraint project_notice_periods_entered_by_fkey 
  foreign key (entered_by) references public.profiles(id) on delete set null;

-- ============================================================================
-- 6. ADD CHECKS
-- ============================================================================

-- daily_delay_cost_usd must be non-negative
alter table public.projects add constraint projects_daily_delay_cost_nonnegative 
  check (daily_delay_cost_usd is null or daily_delay_cost_usd >= 0);

-- counterparty_name must be non-empty when required
alter table public.project_notice_periods drop constraint project_notice_periods_gc_sub_requires_counterparty;
alter table public.project_notice_periods add constraint project_notice_periods_gc_sub_requires_counterparty 
  check (contract_kind != 'gc_sub' or (counterparty_name is not null and btrim(counterparty_name) <> ''));

-- schedule_activities.external_id must match format {proj}:{task}
alter table public.schedule_activities add constraint schedule_activities_external_id_format 
  check (external_id ~ '^[^:]+:.+$');

-- ============================================================================
-- 7. ADD emails.body_text and conversation_id index
-- ============================================================================

-- Add body_text column
alter table public.emails add column body_text text null;

-- Add index on conversation_id
create index idx_emails_conversation on public.emails(org_id, project_id, conversation_id);

-- Update comment
comment on column public.emails.body_text is 'Full plain-text body including quoted reply history; attachments excluded. Stored under RLS, deleted with its email, covered by 30-day disconnect purge';

-- ============================================================================
-- 8. DROP DUPLICATE INDEXES
-- ============================================================================

-- These duplicate the unique constraint indexes
drop index if exists public.idx_raw_records_external_lookup;
drop index if exists public.idx_rfis_external_lookup;
drop index if exists public.idx_submittals_external_lookup;
drop index if exists public.idx_emails_external_lookup;
drop index if exists public.idx_schedule_activities_external_lookup;

-- ============================================================================
-- 9. COMPREHENSIVE PRIVILEGE REVOCATIONS
-- ============================================================================

-- Revoke ALL from anon on all public tables
revoke all on public.orgs from anon;
revoke all on public.profiles from anon;
revoke all on public.org_memberships from anon;
revoke all on public.projects from anon;
revoke all on public.audit_log from anon;
revoke all on public.integration_connections from anon;
revoke all on public.project_sources from anon;
revoke all on public.sync_runs from anon;
revoke all on public.raw_records from anon;
revoke all on public.rfis from anon;
revoke all on public.submittals from anon;
revoke all on public.emails from anon;
revoke all on public.schedule_activities from anon;
revoke all on public.project_notice_periods from anon;
revoke all on public.project_holidays from anon;
revoke all on public.project_parties from anon;

-- Revoke TRUNCATE from authenticated on all public tables
revoke truncate on public.orgs from authenticated;
revoke truncate on public.profiles from authenticated;
revoke truncate on public.org_memberships from authenticated;
revoke truncate on public.projects from authenticated;
revoke truncate on public.audit_log from authenticated;
revoke truncate on public.integration_connections from authenticated;
revoke truncate on public.project_sources from authenticated;
revoke truncate on public.sync_runs from authenticated;
revoke truncate on public.raw_records from authenticated;
revoke truncate on public.rfis from authenticated;
revoke truncate on public.submittals from authenticated;
revoke truncate on public.emails from authenticated;
revoke truncate on public.schedule_activities from authenticated;
revoke truncate on public.project_notice_periods from authenticated;
revoke truncate on public.project_holidays from authenticated;
revoke truncate on public.project_parties from authenticated;

commit;
