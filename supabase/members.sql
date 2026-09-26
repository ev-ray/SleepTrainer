-- The only three people who can sign in. Edit the emails/names, then run in
-- the Supabase SQL editor. To add or remove someone later, edit this table
-- (Table Editor → members) — removing a row cuts off access immediately.
insert into public.members (email, display_name, role) values
  ('you@example.com',     'Evan',    'parent'),
  ('partner@example.com', 'Mom',     'parent'),
  ('grandma@example.com', 'Grandma', 'grandparent')
on conflict (email) do update set display_name = excluded.display_name, role = excluded.role;
