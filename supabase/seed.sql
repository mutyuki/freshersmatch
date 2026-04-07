insert into public.events (
  id,
  name,
  venue_code,
  fixed_bet_amount,
  staff_match_wait_seconds,
  disconnect_threshold_seconds,
  status
)
values (
  '11111111-1111-1111-1111-111111111111',
  'Freshers Welcome Match',
  'MATCH2026',
  120,
  90,
  30,
  'active'
)
on conflict (id) do update
set
  name = excluded.name,
  venue_code = excluded.venue_code,
  fixed_bet_amount = excluded.fixed_bet_amount,
  staff_match_wait_seconds = excluded.staff_match_wait_seconds,
  disconnect_threshold_seconds = excluded.disconnect_threshold_seconds,
  status = excluded.status;

insert into public.admin_users (
  id,
  display_name,
  passcode_hash,
  role
)
values (
  '22222222-2222-2222-2222-222222222222',
  'Event Admin',
  'e838564443d5cadc6c1f739f8dfcb89d:8cb8373b0a2003c412ea23625cd957a219e75ae0a0081e544a5a1d99637647a108afdf5ba48b8ec4d390cb36817cf537ddb3bb6b5ad57556c7413fba70843c1d',
  'admin'
)
on conflict (id) do update
set
  display_name = excluded.display_name,
  passcode_hash = excluded.passcode_hash,
  role = excluded.role;

insert into public.tables (
  event_id,
  table_number,
  game_title,
  status
)
values
  ('11111111-1111-1111-1111-111111111111', 1, 'High Card Sprint', 'available'),
  ('11111111-1111-1111-1111-111111111111', 2, 'Red Black Duel', 'available'),
  ('11111111-1111-1111-1111-111111111111', 3, 'Face Up War', 'available'),
  ('11111111-1111-1111-1111-111111111111', 4, 'Chip Flip', 'available'),
  ('11111111-1111-1111-1111-111111111111', 5, 'Pair Chase', 'available')
on conflict (event_id, table_number) do update
set
  game_title = excluded.game_title,
  status = excluded.status;
