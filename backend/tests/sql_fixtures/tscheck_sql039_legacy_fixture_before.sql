-- Inserted BEFORE 039 runs, so the follow-up check can prove the migration never
-- touches existing ownership rows / wallet balances, only catalog prices.
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-a000-000000000009', 'tscheck-legacy-owner@example.invalid', '{"username":"tscheck_legacy"}')
on conflict (id) do nothing;
insert into public.profiles (id) values ('10000000-0000-4000-a000-000000000009') on conflict (id) do nothing;
insert into public.coin_wallets (user_id, balance) values ('10000000-0000-4000-a000-000000000009', 4242)
on conflict (user_id) do update set balance = 4242;
insert into public.user_vehicle_skins (user_id, skin_id, price_paid) values
  ('10000000-0000-4000-a000-000000000009', 'circuit', 600)
on conflict do nothing;
insert into public.user_profile_frames (user_id, frame_id, price_paid) values
  ('10000000-0000-4000-a000-000000000009', 'neon_sunset', 500)
on conflict do nothing;
