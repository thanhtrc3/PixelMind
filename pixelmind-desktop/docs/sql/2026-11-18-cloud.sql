-- PixelMind cloud schema (D1-24, D1-25). Chạy 1 lần trong SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.pm_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pm_members (
  workspace_id uuid not null references public.pm_workspaces(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('owner','editor','viewer')),
  primary key (workspace_id, email)
);

create table if not exists public.pm_snapshots (
  workspace_id uuid not null references public.pm_workspaces(id) on delete cascade,
  doc text not null check (doc in ('settings','designTokens')),
  schema_version int not null default 1,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (workspace_id, doc)
);

create or replace function public.pm_role(p_workspace uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select m.role
  from public.pm_members m
  where m.workspace_id = p_workspace
    and m.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1
$$;

alter table public.pm_workspaces enable row level security;
alter table public.pm_members enable row level security;
alter table public.pm_snapshots enable row level security;

drop policy if exists pm_ws_select on public.pm_workspaces;
create policy pm_ws_select on public.pm_workspaces
  for select using (public.pm_role(id) is not null);

drop policy if exists pm_ws_insert on public.pm_workspaces;
create policy pm_ws_insert on public.pm_workspaces
  for insert with check (lower(owner_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists pm_mem_select on public.pm_members;
create policy pm_mem_select on public.pm_members
  for select using (public.pm_role(workspace_id) is not null);

drop policy if exists pm_mem_insert on public.pm_members;
create policy pm_mem_insert on public.pm_members
  for insert with check (
    public.pm_role(workspace_id) = 'owner'
    or (
      role = 'owner'
      and email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and exists (
        select 1 from public.pm_workspaces w
        where w.id = pm_members.workspace_id
          and lower(w.owner_email) = lower(auth.jwt() ->> 'email')
      )
    )
  );

drop policy if exists pm_mem_update on public.pm_members;
create policy pm_mem_update on public.pm_members
  for update using (public.pm_role(workspace_id) = 'owner')
  with check (public.pm_role(workspace_id) = 'owner');

drop policy if exists pm_mem_delete on public.pm_members;
create policy pm_mem_delete on public.pm_members
  for delete using (public.pm_role(workspace_id) = 'owner');

drop policy if exists pm_snap_select on public.pm_snapshots;
create policy pm_snap_select on public.pm_snapshots
  for select using (public.pm_role(workspace_id) is not null);

drop policy if exists pm_snap_insert on public.pm_snapshots;
create policy pm_snap_insert on public.pm_snapshots
  for insert with check (public.pm_role(workspace_id) in ('owner', 'editor'));

drop policy if exists pm_snap_update on public.pm_snapshots;
create policy pm_snap_update on public.pm_snapshots
  for update using (public.pm_role(workspace_id) in ('owner', 'editor'))
  with check (public.pm_role(workspace_id) in ('owner', 'editor'));
