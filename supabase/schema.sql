-- Sleep Log — database schema.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Then run supabase/members.sql (with your real emails filled in).
--
-- Security model: only emails listed in public.members can create an account
-- (enforced by a trigger on auth.users), and every table is protected by
-- row-level security that checks the signed-in user's email against that list.
-- Someone with the app's URL and public key can't read or write anything.

-- ─── Family allowlist ────────────────────────────────────────────────────────
create table public.members (
  email text primary key,
  display_name text not null,
  role text not null default 'parent'
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text not null
);

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where lower(m.email) = lower(auth.jwt() ->> 'email')
  )
$$;

-- Block sign-ups from anyone not on the list.
create or replace function public.gate_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.members m where lower(m.email) = lower(new.email)) then
    raise exception 'This email is not on the family list';
  end if;
  return new;
end $$;

create trigger gate_signup
  before insert on auth.users
  for each row execute function public.gate_signup();

-- Give each new account a display name from the allowlist.
create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  select new.id, new.email, m.display_name
  from public.members m where lower(m.email) = lower(new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger create_profile
  after insert on auth.users
  for each row execute function public.create_profile();

-- ─── App data ────────────────────────────────────────────────────────────────
-- One row: the baby's details and family preferences.
create table public.settings (
  id int primary key default 1 check (id = 1),
  baby_name text not null default 'Baby',
  birth_date date,
  due_date date,                      -- only matters if he was born 2+ weeks early
  training_start date,                -- night 1 of sleep training
  feed_interval_hours numeric,        -- night-feed plan: feed if ≥ this many hours since last feed
  nap_limit_min int not null default 60,
  morning_time time not null default '06:00',
  why_note text,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- A nap or a night. Night wakes live in night_wakes.
create table public.sessions (
  id uuid primary key,
  kind text not null check (kind in ('nap', 'night')),
  started_at timestamptz not null,    -- put down in the crib
  asleep_at timestamptz,              -- fell asleep (null = not yet / never)
  ended_at timestamptz,               -- up (null = still going)
  started_by uuid,
  asleep_by uuid,
  ended_by uuid,
  notes text,
  updated_at timestamptz not null default now()
);
create index sessions_started_at on public.sessions (started_at desc);

create table public.night_wakes (
  id uuid primary key,
  session_id uuid not null references public.sessions on delete cascade,
  woke_at timestamptz not null,
  asleep_at timestamptz,              -- back asleep (null = still awake)
  fed boolean not null default false,
  logged_by uuid,
  notes text,
  updated_at timestamptz not null default now()
);
create index night_wakes_session on public.night_wakes (session_id);

-- Ticked items on the between-naps checklist. id = "<window>:<item>".
create table public.checks (
  id text primary key,
  window_id text not null,
  item text not null,
  done_by uuid,
  done_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Row-level security ──────────────────────────────────────────────────────
alter table public.members     enable row level security;
alter table public.profiles    enable row level security;
alter table public.settings    enable row level security;
alter table public.sessions    enable row level security;
alter table public.night_wakes enable row level security;
alter table public.checks      enable row level security;

create policy "family reads members"  on public.members  for select to authenticated using (public.is_member());
create policy "family reads profiles" on public.profiles for select to authenticated using (public.is_member());
create policy "family reads settings" on public.settings for select to authenticated using (public.is_member());
create policy "family edits settings" on public.settings for update to authenticated using (public.is_member()) with check (public.is_member());

create policy "family only" on public.sessions    for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "family only" on public.night_wakes for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "family only" on public.checks      for all to authenticated using (public.is_member()) with check (public.is_member());

revoke all on public.members, public.profiles, public.settings, public.sessions, public.night_wakes, public.checks from anon;
grant select on public.members, public.profiles to authenticated;
grant select, update on public.settings to authenticated;
grant select, insert, update, delete on public.sessions, public.night_wakes, public.checks to authenticated;

-- ─── Live sync ───────────────────────────────────────────────────────────────
alter publication supabase_realtime
  add table public.sessions, public.night_wakes, public.checks, public.settings, public.profiles;
