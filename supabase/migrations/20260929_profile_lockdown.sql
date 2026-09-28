-- For databases created from schema.sql before this fix (databases upgraded
-- with 20260928_families.sql already have it; running it again is harmless).
--
-- Supabase grants every new table to authenticated by default, and the
-- column grant on display_name didn't narrow that, so anyone could change
-- their own family_id and role directly: join any family as its owner.
begin;
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
commit;
