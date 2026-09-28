-- Sleep Log — database schema.
-- Run once in a new Supabase project: SQL Editor → New query → paste → Run.
-- (A database set up from the original single-family schema is upgraded by
-- supabase/migrations/20260928_families.sql instead.)
--
-- Security model: anyone can sign in, but every row belongs to a family and
-- row-level security only lets you see and change your own family's rows.
-- You join a family by creating one (create_family) or by accepting an invite
-- sent to your email (accept_invite). Someone with the app's URL and public
-- key can't read or write anything without being in a family.

-- ─── Families and people ─────────────────────────────────────────────────────
create table public.families (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text not null,
  family_id uuid references public.families on delete set null,
  role text not null default 'member' check (role in ('owner', 'member'))
);
create index profiles_family on public.profiles (family_id);

create or replace function public.my_family() returns uuid
language sql stable security definer set search_path = '' as $$
  select family_id from public.profiles where id = auth.uid()
$$;

-- Every account gets a profile; the name can be changed when joining.
create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger create_profile
  after insert on auth.users
  for each row execute function public.create_profile();

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null default public.my_family() references public.families on delete cascade,
  email text not null check (email = lower(trim(email))),
  display_name text,                  -- what the family will call them
  from_name text,                     -- shown to the invitee
  baby_name text,                     -- shown to the invitee
  invited_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (family_id, email)
);

-- ─── App data ────────────────────────────────────────────────────────────────
-- One row per family: the baby's details and family preferences. id = family.
create table public.settings (
  id uuid primary key references public.families on delete cascade,
  baby_name text not null default 'Baby',
  birth_date date,
  due_date date,                      -- only matters if born 2+ weeks early
  training_start date,                -- night 1 of sleep training
  feed_interval_hours numeric,        -- night-feed plan: feed if ≥ this many hours since last feed
  nap_limit_min int not null default 60,
  morning_time time not null default '06:00',
  why_note text,
  updated_at timestamptz not null default now()
);

-- A nap or a night. Night wakes live in night_wakes.
create table public.sessions (
  id uuid primary key,
  family_id uuid not null default public.my_family() references public.families on delete cascade,
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
create index sessions_family on public.sessions (family_id, started_at desc);

create table public.night_wakes (
  id uuid primary key,
  family_id uuid not null default public.my_family() references public.families on delete cascade,
  session_id uuid not null references public.sessions on delete cascade,
  woke_at timestamptz not null,
  asleep_at timestamptz,              -- back asleep (null = still awake)
  fed boolean not null default false,
  logged_by uuid,
  notes text,
  updated_at timestamptz not null default now()
);
create index night_wakes_session on public.night_wakes (session_id);
create index night_wakes_family on public.night_wakes (family_id);

-- Ticked items on the between-naps checklist. id = "<window>:<item>".
create table public.checks (
  id text primary key,
  family_id uuid not null default public.my_family() references public.families on delete cascade,
  window_id text not null,
  item text not null,
  done_by uuid,
  done_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checks_family on public.checks (family_id);

-- ─── Row-level security ──────────────────────────────────────────────────────
alter table public.families    enable row level security;
alter table public.profiles    enable row level security;
alter table public.invites     enable row level security;
alter table public.settings    enable row level security;
alter table public.sessions    enable row level security;
alter table public.night_wakes enable row level security;
alter table public.checks      enable row level security;

create policy "own family" on public.families for select to authenticated using (id = public.my_family());
create policy "self and family" on public.profiles for select to authenticated
  using (id = auth.uid() or family_id = public.my_family());
create policy "edit own name" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "own family" on public.settings for select to authenticated using (id = public.my_family());
create policy "own family edits" on public.settings for update to authenticated using (id = public.my_family()) with check (id = public.my_family());
-- The app saves with upsert, which checks INSERT policies even when the row exists.
create policy "own family upserts" on public.settings for insert to authenticated with check (id = public.my_family());

create policy "own family" on public.sessions    for all to authenticated using (family_id = public.my_family()) with check (family_id = public.my_family());
create policy "own family" on public.night_wakes for all to authenticated using (family_id = public.my_family()) with check (family_id = public.my_family());
create policy "own family" on public.checks      for all to authenticated using (family_id = public.my_family()) with check (family_id = public.my_family());

-- Your family's pending invites, plus any addressed to you.
create policy "family or invitee reads" on public.invites for select to authenticated
  using (family_id = public.my_family() or email = lower(auth.jwt() ->> 'email'));
create policy "family invites" on public.invites for insert to authenticated with check (family_id = public.my_family());
create policy "family or invitee deletes" on public.invites for delete to authenticated
  using (family_id = public.my_family() or email = lower(auth.jwt() ->> 'email'));

revoke all on public.families, public.profiles, public.invites, public.settings, public.sessions, public.night_wakes, public.checks from anon;
grant select on public.families, public.profiles to authenticated;
-- Only your display name is yours to change; family and role go through the functions below.
-- Supabase grants every new table to authenticated by default, and a column
-- grant doesn't narrow that, so take the table-wide right away first.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, delete on public.invites to authenticated;
grant select, insert, update on public.settings to authenticated;
grant select, insert, update, delete on public.sessions, public.night_wakes, public.checks to authenticated;

-- ─── Family actions ──────────────────────────────────────────────────────────
create or replace function public.create_family(baby_name text, your_name text, birth_date date, due_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare fam uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if public.my_family() is not null then raise exception 'You already belong to a family'; end if;
  insert into public.families (created_by) values (auth.uid()) returning id into fam;
  insert into public.profiles (id, email, display_name, family_id, role)
    values (auth.uid(), auth.jwt() ->> 'email', coalesce(nullif(trim(your_name), ''), split_part(auth.jwt() ->> 'email', '@', 1)), fam, 'owner')
    on conflict (id) do update set family_id = fam, role = 'owner',
      display_name = coalesce(nullif(trim(your_name), ''), public.profiles.display_name);
  insert into public.settings (id, baby_name, birth_date, due_date)
    values (fam, coalesce(nullif(trim(baby_name), ''), 'Baby'), birth_date, due_date);
  return fam;
end $$;

create or replace function public.accept_invite(invite uuid, your_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if public.my_family() is not null then raise exception 'You already belong to a family'; end if;
  select * into inv from public.invites i where i.id = invite and i.email = lower(auth.jwt() ->> 'email');
  if inv.id is null then raise exception 'That invite isn''t for this email'; end if;
  insert into public.profiles (id, email, display_name, family_id, role)
    values (auth.uid(), auth.jwt() ->> 'email', coalesce(nullif(trim(your_name), ''), inv.display_name, split_part(inv.email, '@', 1)), inv.family_id, 'member')
    on conflict (id) do update set family_id = inv.family_id, role = 'member',
      display_name = coalesce(nullif(trim(your_name), ''), inv.display_name, public.profiles.display_name);
  delete from public.invites i where i.email = inv.email;
  return inv.family_id;
end $$;

-- Owners can remove someone from the family. Their account stays; they just
-- lose access to this log.
create or replace function public.remove_member(member uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'owner' and family_id is not null) then
    raise exception 'Only the family owner can remove people';
  end if;
  if member = auth.uid() then raise exception 'You can''t remove yourself'; end if;
  update public.profiles set family_id = null, role = 'member'
    where id = member and family_id = public.my_family();
end $$;

-- Trigger functions only run from triggers; nobody needs to call them directly.
revoke execute on function public.create_profile() from public, anon, authenticated;
revoke execute on function public.my_family(), public.create_family(text, text, date, date),
  public.accept_invite(uuid, text), public.remove_member(uuid) from public, anon;
grant execute on function public.my_family(), public.create_family(text, text, date, date),
  public.accept_invite(uuid, text), public.remove_member(uuid) to authenticated;

-- ─── Live sync ───────────────────────────────────────────────────────────────
alter publication supabase_realtime
  add table public.sessions, public.night_wakes, public.checks, public.settings, public.profiles;
