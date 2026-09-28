-- Families: turn the single-family log into one that serves any number of
-- families, each seeing only its own baby.
--
-- For a database created from the original schema.sql. Everyone already on
-- the members list becomes a member of one family that owns all existing
-- data; the members list and the sign-up gate go away (anyone can sign in,
-- then set up a baby or accept an invite).

begin;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column family_id uuid references public.families on delete set null,
  add column role text not null default 'member' check (role in ('owner', 'member'));
create index profiles_family on public.profiles (family_id);

create or replace function public.my_family() returns uuid
language sql stable security definer set search_path = '' as $$
  select family_id from public.profiles where id = auth.uid()
$$;

-- ─── Move the existing family in ─────────────────────────────────────────────
do $$
declare fam uuid := gen_random_uuid();
declare founder uuid;
begin
  -- Whoever signed up first set the app up; they become the family owner.
  select p.id into founder from public.profiles p
    join public.members m on lower(m.email) = lower(p.email)
    join auth.users u on u.id = p.id
    order by u.created_at limit 1;
  insert into public.families (id, created_by) values (fam, founder);
  update public.profiles p set family_id = fam,
    role = case when p.id = founder then 'owner' else 'member' end
    where exists (select 1 from public.members m where lower(m.email) = lower(p.email));

  alter table public.settings drop constraint settings_id_check;
  alter table public.settings alter column id drop default;
  execute format('alter table public.settings alter column id type uuid using %L::uuid', fam);

  alter table public.sessions add column family_id uuid;
  alter table public.night_wakes add column family_id uuid;
  alter table public.checks add column family_id uuid;
  update public.sessions set family_id = fam;
  update public.night_wakes set family_id = fam;
  update public.checks set family_id = fam;

  -- Anyone on the list who never signed in gets an invite instead.
  create table public.invites (
    id uuid primary key default gen_random_uuid(),
    family_id uuid not null default public.my_family() references public.families on delete cascade,
    email text not null check (email = lower(trim(email))),
    display_name text,
    from_name text,
    baby_name text,
    invited_by uuid default auth.uid() references auth.users on delete set null,
    created_at timestamptz not null default now(),
    unique (family_id, email)
  );
  insert into public.invites (family_id, email, display_name, invited_by)
    select fam, lower(trim(m.email)), m.display_name, founder from public.members m
    where not exists (select 1 from public.profiles p where lower(p.email) = lower(m.email));
end $$;

alter table public.settings add constraint settings_family foreign key (id) references public.families on delete cascade;

alter table public.sessions    alter column family_id set not null, alter column family_id set default public.my_family(),
  add constraint sessions_family foreign key (family_id) references public.families on delete cascade;
alter table public.night_wakes alter column family_id set not null, alter column family_id set default public.my_family(),
  add constraint night_wakes_family foreign key (family_id) references public.families on delete cascade;
alter table public.checks      alter column family_id set not null, alter column family_id set default public.my_family(),
  add constraint checks_family foreign key (family_id) references public.families on delete cascade;
create index sessions_family on public.sessions (family_id, started_at desc);
create index night_wakes_family on public.night_wakes (family_id);
create index checks_family on public.checks (family_id);

-- ─── Policies: everything scoped to your own family ─────────────────────────
drop policy "family reads members"    on public.members;
drop policy "family reads profiles"   on public.profiles;
drop policy "family reads settings"   on public.settings;
drop policy "family edits settings"   on public.settings;
drop policy "family upserts settings" on public.settings;
drop policy "family only" on public.sessions;
drop policy "family only" on public.night_wakes;
drop policy "family only" on public.checks;

alter table public.families enable row level security;
alter table public.invites  enable row level security;

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

revoke all on public.families, public.invites from anon;
grant select on public.families to authenticated;
grant select, insert, delete on public.invites to authenticated;
-- Only your display name is yours to change; family and role go through the functions below.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ─── Sign-up: open to anyone ────────────────────────────────────────────────
drop trigger gate_signup on auth.users;
drop function public.gate_signup();

create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

drop function public.is_member();
drop table public.members;

-- ─── Family actions ─────────────────────────────────────────────────────────
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

revoke execute on function public.create_profile() from public, anon, authenticated;
revoke execute on function public.my_family(), public.create_family(text, text, date, date),
  public.accept_invite(uuid, text), public.remove_member(uuid) from public, anon;
grant execute on function public.my_family(), public.create_family(text, text, date, date),
  public.accept_invite(uuid, text), public.remove_member(uuid) to authenticated;

commit;
