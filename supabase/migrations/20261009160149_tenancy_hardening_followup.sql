-- Migration 0004: Tenancy hardening follow-up (fixes gaps in merged PR #8)
-- Fixes: column-specific SET NULL, missing cascades, user delete FKs, anon privileges

-- ============================================================================
-- PRE-CHECK: Verify no data mismatches before applying constraints
-- ============================================================================

do $$
declare
  mismatch_count int;
begin
  -- Check for cross-org connection references in project_sources
  select count(*) into mismatch_count
  from public.project_sources ps
  left join public.integration_connections ic 
    on ps.connection_id = ic.id and ps.org_id = ic.org_id
  where ic.id is null;
  
  if mismatch_count > 0 then
    raise exception 'Found % project_sources with cross-org connection_id references', mismatch_count;
  end if;
  
  -- Check for cross-org project_source references in sync_runs
  select count(*) into mismatch_count
  from public.sync_runs sr
  left join public.project_sources ps 
    on sr.project_source_id = ps.id and sr.org_id = ps.org_id and sr.project_id = ps.project_id
  where ps.id is null;
  
  if mismatch_count > 0 then
    raise exception 'Found % sync_runs with cross-org project_source_id references', mismatch_count;
  end if;
end;
$$;

-- ============================================================================
-- 1. FIX COLUMN-SPECIFIC SET NULL for composite FKs
-- ============================================================================

-- schedule_activities.raw_record_id -> raw_records (nullable, part of 3-column FK)
alter table public.schedule_activities drop constraint schedule_activities_raw_record_fk;
alter table public.schedule_activities add constraint schedule_activities_raw_record_fk 
  foreign key (raw_record_id, org_id, project_id) references public.raw_records(id, org_id, project_id) on delete set null (raw_record_id);

-- ============================================================================
-- 2. ADD CASCADE to composite FK that replaced cascading single-column FKs
-- ============================================================================

-- project_sources.connection_id -> integration_connections (was cascade in 0002)
alter table public.project_sources drop constraint project_sources_connection_fk;
alter table public.project_sources add constraint project_sources_connection_fk 
  foreign key (connection_id, org_id) references public.integration_connections(id, org_id) on delete cascade;

-- sync_runs.project_source_id -> project_sources (was cascade in 0002)
alter table public.sync_runs drop constraint sync_runs_project_source_fk;
alter table public.sync_runs add constraint sync_runs_project_source_fk 
  foreign key (project_source_id, org_id, project_id) references public.project_sources(id, org_id, project_id) on delete cascade;

-- ============================================================================
-- 3. ADD ON DELETE SET NULL for user FKs
-- ============================================================================

-- projects.created_by -> profiles
alter table public.projects drop constraint projects_created_by_fkey;
alter table public.projects add constraint projects_created_by_fkey 
  foreign key (created_by) references public.profiles(id) on delete set null;

-- audit_log.actor_user_id -> profiles
alter table public.audit_log drop constraint audit_log_actor_user_id_fkey;
alter table public.audit_log add constraint audit_log_actor_user_id_fkey 
  foreign key (actor_user_id) references public.profiles(id) on delete set null;

-- ============================================================================
-- 4. ADD MISSING audit_log org FK with CASCADE
-- ============================================================================

alter table public.audit_log add constraint audit_log_org_fk 
  foreign key (org_id) references public.orgs(id) on delete cascade;

-- ============================================================================
-- 5. COMPREHENSIVE ANON PRIVILEGE REVOCATION
-- ============================================================================

-- Revoke ALL from anon on all tables and sequences
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Alter default privileges: anon gets nothing
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

-- Alter default privileges: authenticated cannot truncate
alter default privileges for role postgres in schema public revoke truncate on tables from authenticated;
