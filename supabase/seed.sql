-- Seed two auth users for tests (AUTH_USER_A / AUTH_USER_B).
insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','a@example.test','authenticated','authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','b@example.test','authenticated','authenticated')
on conflict (id) do nothing;
