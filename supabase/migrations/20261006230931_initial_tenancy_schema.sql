-- Migration 0001: Initial multi-tenant schema with RLS
-- Creates: orgs, profiles, org_memberships, projects, audit_log
-- Includes: RLS helpers and policies for org-based tenancy

-- Note: gen_random_uuid() is built-in, no extension needed

-- ============================================================================
-- TABLES
-- ============================================================================

-- Organizations table
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now(),
  constraint orgs_name_length check (char_length(name) >= 1 and char_length(name) <= 255),
  constraint orgs_slug_format check (slug ~ '^[a-z0-9-]+$' and char_length(slug) >= 2 and char_length(slug) <= 63)
);

-- User profiles table (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

-- Organization memberships table
create table public.org_memberships (
  org_id uuid not null references public.orgs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Projects table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs on delete cascade,
  name text not null,
  number text,
  timezone text not null default 'America/New_York',
  settings jsonb not null default '{}',
  created_by uuid references public.profiles,
  created_at timestamptz not null default now(),
  constraint projects_name_length check (char_length(name) >= 1 and char_length(name) <= 255)
);

-- Audit log table
create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid references public.orgs on delete set null,
  actor_type text not null check (actor_type in ('user', 'system')),
  actor_user_id uuid references public.profiles,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create index idx_org_memberships_user_id on public.org_memberships(user_id);
create index idx_projects_org_id on public.projects(org_id);
create index idx_audit_log_org_created on public.audit_log(org_id, created_at desc);

-- ============================================================================
-- RLS HELPER FUNCTIONS
-- ============================================================================

-- Check if current user is a member of the specified org
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.org_memberships
    where org_id = p_org_id
      and user_id = auth.uid()
  );
$$;

-- Check if current user has one of the specified roles in the org
create or replace function public.has_org_role(p_org_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.org_memberships
    where org_id = p_org_id
      and user_id = auth.uid()
      and role = any(p_roles)
  );
$$;

-- Create org with caller as owner (atomically)
create or replace function public.create_org(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  
  -- Insert org
  insert into public.orgs (name, slug)
  values (p_name, p_slug)
  returning id into v_org_id;
  
  -- Insert caller as owner
  insert into public.org_memberships (org_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');
  
  -- Log the action
  insert into public.audit_log (org_id, actor_type, actor_user_id, action, target_table, target_id)
  values (v_org_id, 'user', v_user_id, 'create_org', 'orgs', v_org_id);
  
  return v_org_id;
end;
$$;

-- Revoke public and anon access to helper functions
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.has_org_role(uuid, text[]) from public, anon;
revoke execute on function public.create_org(text, text) from public, anon;

-- Grant access to authenticated users only
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.create_org(text, text) to authenticated;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Automatically create profile when user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent removing the last owner from an org (unless org is being deleted)
create or replace function public.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_count int;
  org_exists boolean;
begin
  -- Only check if we're deleting or changing role of an owner
  if (TG_OP = 'DELETE' and old.role = 'owner') or 
     (TG_OP = 'UPDATE' and old.role = 'owner' and new.role != 'owner') then
    
    -- Check if org still exists (if not, this is part of cascade delete)
    select exists(select 1 from public.orgs where id = old.org_id) into org_exists;
    
    -- If org doesn't exist, allow the operation (cascade delete)
    if not org_exists then
      if TG_OP = 'DELETE' then
        return old;
      else
        return new;
      end if;
    end if;
    
    -- Count remaining owners (excluding the one being removed/demoted)
    select count(*)
    into owner_count
    from public.org_memberships
    where org_id = old.org_id
      and role = 'owner'
      and user_id != old.user_id;
    
    if owner_count = 0 then
      raise exception 'Cannot remove the last owner from an organization';
    end if;
  end if;
  
  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

revoke execute on function public.prevent_last_owner_removal() from public, anon;

create trigger prevent_last_owner_removal
  before update or delete on public.org_memberships
  for each row execute function public.prevent_last_owner_removal();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
alter table public.orgs enable row level security;
alter table public.profiles enable row level security;
alter table public.org_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.audit_log enable row level security;

-- ============================================================================
-- RLS POLICIES: orgs
-- ============================================================================

-- Members can view their orgs
create policy "Members can view their orgs"
  on public.orgs for select
  to authenticated
  using (public.is_org_member(id));

-- No direct insert - use create_org() function instead

-- Owners and admins can update their orgs
create policy "Owners and admins can update orgs"
  on public.orgs for update
  to authenticated
  using (public.has_org_role(id, array['owner', 'admin']))
  with check (public.has_org_role(id, array['owner', 'admin']));

-- Only owners can delete orgs
create policy "Owners can delete orgs"
  on public.orgs for delete
  to authenticated
  using (public.has_org_role(id, array['owner']));

-- ============================================================================
-- RLS POLICIES: profiles
-- ============================================================================

-- Users can view profiles in their shared orgs, or their own profile
create policy "Users can view profiles in shared orgs or own"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid() or
    exists (
      select 1
      from public.org_memberships om1
      inner join public.org_memberships om2 on om1.org_id = om2.org_id
      where om1.user_id = auth.uid()
        and om2.user_id = profiles.id
    )
  );

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================================
-- RLS POLICIES: org_memberships
-- ============================================================================

-- Members can view memberships of their orgs
create policy "Members can view org memberships"
  on public.org_memberships for select
  to authenticated
  using (public.is_org_member(org_id));

-- Only owners can insert owner roles; admins can insert member/admin roles
create policy "Owners can add owners; admins can add members/admins"
  on public.org_memberships for insert
  to authenticated
  with check (
    (role = 'owner' and public.has_org_role(org_id, array['owner'])) or
    (role in ('admin', 'member') and public.has_org_role(org_id, array['owner', 'admin']))
  );

-- Only owners can modify owner roles; admins can modify member/admin roles
-- Nobody can change their own role
create policy "Owners can modify owners; admins can modify members/admins"
  on public.org_memberships for update
  to authenticated
  using (
    user_id != auth.uid() and (
      (role = 'owner' and public.has_org_role(org_id, array['owner'])) or
      (role in ('admin', 'member') and public.has_org_role(org_id, array['owner', 'admin']))
    )
  )
  with check (
    user_id != auth.uid() and (
      (role = 'owner' and public.has_org_role(org_id, array['owner'])) or
      (role in ('admin', 'member') and public.has_org_role(org_id, array['owner', 'admin']))
    )
  );

-- Only owners can remove owners; admins can remove members/admins
-- Members can leave (delete their own membership)
create policy "Owners can remove owners; admins can remove members/admins; members can leave"
  on public.org_memberships for delete
  to authenticated
  using (
    user_id = auth.uid() or
    (role = 'owner' and public.has_org_role(org_id, array['owner'])) or
    (role in ('admin', 'member') and public.has_org_role(org_id, array['owner', 'admin']))
  );

-- ============================================================================
-- RLS POLICIES: projects
-- ============================================================================

-- Org members can view projects in their orgs
create policy "Org members can view projects"
  on public.projects for select
  to authenticated
  using (public.is_org_member(org_id));

-- Owners and admins can create projects in their orgs
create policy "Owners and admins can create projects"
  on public.projects for insert
  to authenticated
  with check (public.has_org_role(org_id, array['owner', 'admin']));

-- Owners and admins can update projects in their orgs
create policy "Owners and admins can update projects"
  on public.projects for update
  to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']))
  with check (public.has_org_role(org_id, array['owner', 'admin']));

-- Owners and admins can delete projects in their orgs
create policy "Owners and admins can delete projects"
  on public.projects for delete
  to authenticated
  using (public.has_org_role(org_id, array['owner', 'admin']));

-- ============================================================================
-- RLS POLICIES: audit_log
-- ============================================================================

-- Org members can view audit logs for their orgs only
create policy "Org members can view audit logs"
  on public.audit_log for select
  to authenticated
  using (public.is_org_member(org_id));

-- No direct insert/update/delete for authenticated users
-- Service role bypasses RLS for background jobs and system actions

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table public.orgs is 'Organizations - top-level tenant boundary';
comment on table public.profiles is 'User profiles extending auth.users';
comment on table public.org_memberships is 'User membership in organizations with roles';
comment on table public.projects is 'Construction projects belonging to organizations';
comment on table public.audit_log is 'Audit trail for org actions (service role writes only)';

comment on function public.is_org_member(uuid) is 'RLS helper: check if current user is org member';
comment on function public.has_org_role(uuid, text[]) is 'RLS helper: check if current user has specified role(s) in org';
comment on function public.create_org(text, text) is 'Create org with caller as owner atomically';
comment on function public.handle_new_user() is 'Trigger: auto-create profile on user signup';
comment on function public.prevent_last_owner_removal() is 'Trigger: prevent removing last owner (unless org is being deleted)';
