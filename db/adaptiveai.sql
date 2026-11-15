-- AdaptiveAI isolated schema for a DEDICATED Supabase project.
-- Do not apply to the unrelated/inactive smart-rental-station-room project.
-- RLS mandatory on every public table. Review in SQL Editor before running.

create table if not exists public.adaptive_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null default 'default' check (slug ~ '^[a-z0-9_-]{1,50}$'),
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,slug)
);
create index if not exists adaptive_workspaces_owner_idx on public.adaptive_workspaces(owner_id);
alter table public.adaptive_workspaces enable row level security;
revoke all on public.adaptive_workspaces from public, anon;
grant select, insert, update, delete on public.adaptive_workspaces to authenticated;
drop policy if exists adaptive_workspace_select on public.adaptive_workspaces;
drop policy if exists adaptive_workspace_insert on public.adaptive_workspaces;
drop policy if exists adaptive_workspace_update on public.adaptive_workspaces;
drop policy if exists adaptive_workspace_delete on public.adaptive_workspaces;
create policy adaptive_workspace_select on public.adaptive_workspaces for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy adaptive_workspace_insert on public.adaptive_workspaces for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy adaptive_workspace_update on public.adaptive_workspaces for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy adaptive_workspace_delete on public.adaptive_workspaces for delete to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.adaptive_touch_workspace()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.updated_at=now();
  return new;
end;
$$;
drop trigger if exists adaptive_workspace_updated on public.adaptive_workspaces;
create trigger adaptive_workspace_updated before update on public.adaptive_workspaces
  for each row execute function public.adaptive_touch_workspace();
revoke all on function public.adaptive_touch_workspace() from public,anon,authenticated;
-- Triggers execute as table owner; direct RPC execution is deliberately denied.

create table if not exists public.adaptive_agent_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null default gen_random_uuid(),
  workflow_id text not null check (length(workflow_id) between 1 and 90),
  status text not null check (status in ('awaiting_approval','completed','rejected','blocked')),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  created_at timestamptz not null default now(),
  unique(owner_id,request_key)
);
create index if not exists adaptive_runs_owner_created_idx on public.adaptive_agent_runs(owner_id,created_at desc);
alter table public.adaptive_agent_runs enable row level security;
revoke all on public.adaptive_agent_runs from public, anon;
grant select,insert,update on public.adaptive_agent_runs to authenticated;
drop policy if exists adaptive_runs_select on public.adaptive_agent_runs;
drop policy if exists adaptive_runs_insert on public.adaptive_agent_runs;
drop policy if exists adaptive_runs_update on public.adaptive_agent_runs;
create policy adaptive_runs_select on public.adaptive_agent_runs for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy adaptive_runs_insert on public.adaptive_agent_runs for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy adaptive_runs_update on public.adaptive_agent_runs for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Server-only daily quota counter; the browser must not be able to reset its quota.
create table if not exists public.adaptive_ai_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  used integer not null default 0 check (used >= 0),
  last_call_at timestamptz not null default now(),
  primary key(owner_id,usage_day)
);
alter table public.adaptive_ai_usage enable row level security;
revoke all on public.adaptive_ai_usage from public, anon, authenticated;
grant select,insert,update on public.adaptive_ai_usage to service_role;

-- This RPC is accessible ONLY via server-held service role, after user verification.
-- CONCURRENCY: INSERT ... ON CONFLICT obtains a row lock; cap+cooldown are atomic.
create or replace function public.adaptive_claim_ai_quota(
  p_owner uuid, p_daily_cap integer default 15, p_cooldown_seconds integer default 12
)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_ok boolean;
begin
  if p_owner is null or p_daily_cap not between 1 and 100
    or p_cooldown_seconds not between 1 and 3600 then
    return false;
  end if;
  insert into public.adaptive_ai_usage as usage(owner_id,usage_day,used,last_call_at)
  values(p_owner,(now() at time zone 'UTC')::date,1,now())
  on conflict (owner_id,usage_day) do update
    set used=usage.used+1,last_call_at=now()
  where usage.used < p_daily_cap
    and usage.last_call_at < now()-make_interval(secs => p_cooldown_seconds)
  returning true into v_ok;
  return coalesce(v_ok,false);
end;
$$;
revoke all on function public.adaptive_claim_ai_quota(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.adaptive_claim_ai_quota(uuid,integer,integer) to service_role;

-- No service-role key is ever placed in a browser bundle.
-- After deployment: run Supabase security advisors and verify cross-user isolation.
