insert into public.events (
  id,
  name,
  venue_code,
  initial_chip_balance,
  fixed_bet_amount,
  staff_match_wait_seconds,
  disconnect_threshold_seconds,
  status
)
values (
  '11111111-1111-1111-1111-111111111111',
  'Freshers Welcome Match',
  'MATCH2026',
  500,
  120,
  90,
  30,
  'active'
)
on conflict (id) do update
set
  name = excluded.name,
  venue_code = excluded.venue_code,
  initial_chip_balance = excluded.initial_chip_balance,
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

insert into public.game_rules (
  id,
  event_id,
  title,
  body
)
values
  (
    '33333333-3333-3333-3333-333333333331',
    '11111111-1111-1111-1111-111111111111',
    'High Card Sprint ルール',
    '1. 山札をよく切って配る。2. 同時に1枚めくり、数字が大きい方の勝ち。3. Aが最強、同値は引き分けでやり直し。'
  ),
  (
    '33333333-3333-3333-3333-333333333332',
    '11111111-1111-1111-1111-111111111111',
    'Red Black Duel ルール',
    '1. 1枚ずつカードを引く。2. 赤か黒かを先に宣言する。3. 的中で勝利、外れたら相手の勝利。'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'Face Up War ルール',
    '1. 各プレイヤーは3枚を表向きに置く。2. 合計値が高い方の勝ち。3. 同点なら中央の1枚で決着。'
  ),
  (
    '33333333-3333-3333-3333-333333333334',
    '11111111-1111-1111-1111-111111111111',
    'Chip Flip ルール',
    '1. コインまたはチップを交互に弾く。2. 先に3回成功させた方の勝ち。3. テーブル外に落としたら失敗。'
  ),
  (
    '33333333-3333-3333-3333-333333333335',
    '11111111-1111-1111-1111-111111111111',
    'Pair Chase ルール',
    '1. 交互に2枚ずつ引く。2. 先に同じ数字のペアを作った方の勝ち。3. 山札が尽きたら手札合計の大きい方が勝ち。'
  )
on conflict (id) do update
set
  title = excluded.title,
  body = excluded.body;

update public.tables
set game_rule_id = case table_number
  when 1 then '33333333-3333-3333-3333-333333333331'
  when 2 then '33333333-3333-3333-3333-333333333332'
  when 3 then '33333333-3333-3333-3333-333333333333'
  when 4 then '33333333-3333-3333-3333-333333333334'
  when 5 then '33333333-3333-3333-3333-333333333335'
  else game_rule_id
end
where event_id = '11111111-1111-1111-1111-111111111111';
