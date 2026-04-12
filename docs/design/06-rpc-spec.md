# 06. RPC 仕様

この文書は、MVPで使う PostgreSQL 関数 / Supabase RPC の契約を固定する。

## 1. 共通ルール

### ロック順

複数テーブルを触るときは、原則として以下の順で対象行を `for update` する。

1. `events`
2. `participants`
3. `matches`
4. `tables`

`chip_ledger` は insert のみでよい。

### 再試行方針

- serialization failure
- row lock 競合

上記のみアプリ層で短い再試行を許可する。
業務条件エラーは再試行しない。

### idempotency 方針

- `ready_match`
- `claim_match_win`
- `approve_match_result`
- `resolve_match_by_admin`
- `resolve_staff_match`
- `pause_participant`
- `unpause_participant`
- `hold_table_by_admin`
- `release_table_admin_hold`

は、同じ状態で二重実行されても二重反映しない。
二度目は現在状態をそのまま返す。

### void 系介入時のベット戻し方針

- `resolve_match_by_admin`（`p_resolution_type = 'void'`）
- `pause_participant`（対戦中 participant の match を `voided_by_admin` にする場合）
- `disqualify_participant`（`p_mode = 'void_current_match'`）
- `force_release_table`（active match を `voided_by_admin` にする場合）

上記で対象 match が `in_progress` または `winner_claimed`（= ベット差し引き済み）の場合は、各参加者に `rollback` reason で `+agreed_bet_amount` を 1 行ずつ記録し、`chip_balance` を試合前の状態へ戻す。

`reserved` / `awaiting_ready` などベット未実行状態で無効化する場合は ledger 追記を行わない。

### `last_non_disconnect_status` 更新方針

- `last_non_disconnect_status` は「`status != disconnected` の参加者が進行状態を更新するとき」だけ更新する
- `heartbeat` や token 検証では更新しない
- `disconnected` への遷移・復帰責務は service 層に置き、RPC は通常進行の状態更新だけを担う

## 2. RPC 一覧

### `register_participant_and_issue_session`

- 入力:
  - `p_venue_code text`
  - `p_nickname text`
  - `p_session_token_hash text`
- 戻り値:
  - `participant_id uuid`
  - `event_id uuid`
  - `session_id uuid`
  - `chip_balance integer`

### `start_queue_and_try_match`

- 入力:
  - `p_participant_id uuid`
  - `p_opponent_participant_id uuid nullable`
  - `p_table_id uuid nullable`
- 戻り値:
  - `match_id uuid nullable`
  - `participant_status text`
- 補足:
  - 事前条件: `chip_balance > 0` の参加者のみ待機開始を許可する
  - `chip_balance <= 0` の場合は業務条件エラーを返す
  - `registered` の参加者は `queueing` に遷移させた上でマッチ試行する
  - 既に `queueing` の参加者に対しては、待機状態を維持したままマッチ試行のみ行える
  - `p_opponent_participant_id` または `p_table_id` が `null` の場合は `queueing` にするだけで終了する
  - 指定した opponent / table は RPC 内で再検証し、無効化されていた場合は代替候補を選ばず `queueing` のまま返す
  - match / participants / tables の多表更新はこの RPC だけが行う

### `cancel_queue`

- 入力:
  - `p_participant_id uuid`
- 戻り値:
  - `participant_status text`

### `ready_match`

- 入力:
  - `p_participant_id uuid`
  - `p_match_id uuid`
- 戻り値:
  - `match_status text`
  - `participant_status text`
  - `agreed_bet_amount integer nullable`
  - `started_at timestamptz nullable`
- 補足:
  - 通常戦: 片方が ready → `match.status = awaiting_ready`、双方 ready → ベット差し引きして `in_progress`
  - 運営戦 (`is_staff_match=true`): 参加者 1 人の ready で `match.status` は `reserved → in_progress` へ直接遷移する。`awaiting_ready` は経由しない
  - 運営戦では participant.status も `match_reserved → playing` へ直接遷移し、`ready` は経由しない
  - `actual_bet` は `FOR UPDATE` ロック後に再計算する。ロック前の残高で計算しない
  - 実際のベット額は `min(player1.chip_balance, player2.chip_balance, fixed_bet_amount)`、運営戦は `min(player.chip_balance, fixed_bet_amount)`
  - ベット差し引き時に `chip_ledger` に `match_bet` reason で記録する
  - `started_at` は `in_progress` へ遷移した瞬間に設定する
  - 既に ready 済みの参加者が再度呼び出した場合は、現在状態をそのまま返す（idempotent）

### `cancel_match_before_start`

- 入力:
  - `p_participant_id uuid`
  - `p_match_id uuid`
- 戻り値:
  - `match_status text`

### `claim_match_win`

- 入力:
  - `p_participant_id uuid`
  - `p_match_id uuid`
- 戻り値:
  - `match_status text`

### `approve_match_result`

- 入力:
  - `p_participant_id uuid`
  - `p_match_id uuid`
  - `p_approve boolean`
- 戻り値:
  - `match_status text`
  - `dispute_count integer`
- 補足:
  - `p_approve = true`（承認成功）の場合の全副作用:
    1. `matches.status` を `winner_claimed → completed` に更新
    2. `matches.winner_participant_id` を `winner_claimed_by_participant_id` の値で確定
    3. `matches.completed_at` を現在時刻に設定
    4. 勝者に `match_payout` reason で `+(actual_bet * 2)` を `chip_ledger` に追加し、`chip_balance` を更新
    5. 卓を `in_use → available` に解放し、`tables.current_match_id` を null にする
    6. 両参加者の `participants.status` を `result_confirmed` に遷移
    7. 両参加者の `participants.current_match_id` は保持する（結果表示・再接続復帰の参照用）。`null` 化は `acknowledge_result_confirmed` で行う
    8. 両参加者の `last_opponent_participant_id` を互いに更新
    9. これらを 1 トランザクションで完結する
  - `p_approve = false`（承認拒否）の場合:
    1. `matches.status` を `winner_claimed → in_progress` に戻す
    2. `matches.winner_claimed_by_participant_id` を null にクリア
    3. `matches.winner_claimed_at` を null にクリア
    4. `matches.dispute_count` を +1
    5. `matches.last_disputed_at` を現在時刻に設定
    6. 両参加者を `playing` に戻す
  - 二重承認防止: `matches.status = 'winner_claimed'` を前提条件とし、それ以外では現在状態を返す（idempotent）

### `adjust_participant_chip`

- 入力:
  - `p_admin_user_id uuid`
  - `p_participant_id uuid`
  - `p_delta integer`
  - `p_reason text`
- 戻り値:
  - `new_balance integer`
- 補足:
  - `chip_balance + p_delta >= 0` を事前検証し、下回る場合はエラーを返す（DB の `chip_balance >= 0` check 制約と整合）
  - `chip_ledger` に `admin_adjustment` reason で 1 行追加する
  - `balance_after = chip_balance + p_delta` を ledger に記録する
  - `p_delta = 0` は許可するが、実効なしとして扱ってよい

### `resolve_match_by_admin`

- 入力:
  - `p_admin_user_id uuid`
  - `p_match_id uuid`
  - `p_resolution_type text`
  - `p_winner_participant_id uuid nullable`
- 戻り値:
  - `match_status text`
- 補足:
  - `p_resolution_type = 'void'` は `reserved / awaiting_ready / in_progress / winner_claimed` を許可する
  - `p_resolution_type = 'void'` で `started_at` / `agreed_bet_amount` が非 `null` の場合は、共通方針に従って rollback を行う
  - `p_resolution_type = 'winner'`（`force_finished_by_admin`）は `in_progress / winner_claimed` のみ許可する
  - `force_finished_by_admin` では `started_at` / `agreed_bet_amount` を保持し、結果反映後に両参加者を `result_confirmed` へ遷移させる
  - `force_finished_by_admin` では `matches.completed_at = now()` を必ず設定する
  - `force_finished_by_admin` でも両参加者の `participants.current_match_id` は保持する。`null` 化は `acknowledge_result_confirmed` で行う
  - 対人戦の `force_finished_by_admin` では `last_opponent_participant_id` を互いに更新する。運営戦では更新しない

### `start_staff_match`

- 入力:
  - `p_admin_user_id uuid`
  - `p_participant_id uuid`
  - `p_table_id uuid nullable`
- 戻り値:
  - `match_id uuid`

### `resolve_staff_match`

- 入力:
  - `p_admin_user_id uuid`
  - `p_match_id uuid`
  - `p_participant_won boolean`
- 戻り値:
  - `match_status text`
- 補足:
  - 対象は `is_staff_match = true` かつ `status in ('in_progress', 'winner_claimed')` の match のみ許可する
  - `matches.status` を結果反映後に `completed` へ更新する
  - `matches.completed_at = now()` を必ず設定する
  - 卓を `available` に解放し、`tables.current_match_id` を `null` にする
  - 参加者の `participants.status` は `result_confirmed` に遷移させる
  - 参加者の `participants.current_match_id` は保持する。`null` 化は `acknowledge_result_confirmed` で行う
  - 開始時の `match_bet` は維持し、`p_participant_won = true` のときだけ `match_payout` を記録する
  - 運営戦では `last_opponent_participant_id` を更新しない

### `acknowledge_result_confirmed`

- 入力:
  - `p_participant_id uuid`
- 戻り値:
  - `participant_status text`
- 補足:
  - `participants.status` を `result_confirmed → registered` に遷移する
  - `participants.current_match_id` を `null` に戻す
  - 既に `registered` の場合は現在状態をそのまま返す（idempotent）

### `pause_participant`

- 入力:
  - `p_admin_user_id uuid`
  - `p_participant_id uuid`
- 戻り値:
  - `participant_status text`
  - `affected_match_id uuid nullable`
- 補足:
  - 対戦中の participant を pause する場合、紐づく match を `voided_by_admin` にし、卓を解放し、対戦相手を `registered` に戻す
  - 上記で対象 match が `in_progress` / `winner_claimed` の場合は、共通方針に従って rollback を行う
  - queueing の participant を pause する場合は queue から外す
  - 既に `paused` なら現在状態をそのまま返す（idempotent）

### `unpause_participant`

- 入力:
  - `p_admin_user_id uuid`
  - `p_participant_id uuid`
- 戻り値:
  - `participant_status text`
- 補足:
  - `paused → registered` への遷移のみ許可する
  - `paused` 以外で呼ばれたら現在状態をそのまま返す（idempotent）

### `disqualify_participant`

- 入力:
  - `p_admin_user_id uuid`
  - `p_participant_id uuid`
  - `p_mode text` — `'void_current_match'` または `'lose_current_match'`
  - `p_reason text`
- 戻り値:
  - `participant_status text`
  - `affected_match_id uuid nullable`
- 補足:
  - `void_current_match`: 対戦中 match を `voided_by_admin` にし、卓解放、相手を `registered` に戻す。対象 match が `in_progress` / `winner_claimed` の場合は、共通方針に従って rollback を行う
  - `lose_current_match`: 対戦中 match を `force_finished_by_admin` にし、相手を勝者として結果確定し、チップ反映後に卓解放、相手を `result_confirmed` に遷移
  - 対戦中でない場合は match 側の副作用なしで `disqualified` にする
  - queueing の participant は queue から外す

### `force_release_table`

- 入力:
  - `p_admin_user_id uuid`
  - `p_table_id uuid`
- 戻り値:
  - `table_status text`
  - `affected_match_id uuid nullable`
- 補足:
  - 卓に紐づく active match があれば `voided_by_admin` にする
  - 関連する participant を `registered` に戻す
  - 卓を `available` にする
  - 対象 match が `in_progress` / `winner_claimed` の場合は、共通方針に従って rollback を行う
  - `reserved` / `awaiting_ready` の場合はベット未実行なので ledger 追記なし
  - `last_opponent_participant_id` は更新しない（`voided_by_admin` のルール）

### `hold_table_by_admin`

- 入力:
  - `p_admin_user_id uuid`
  - `p_table_id uuid`
- 戻り値:
  - `table_status text`
- 補足:
  - `available` の卓を `admin_hold` にする
  - `reserved` / `in_use` の卓に対しては先に match を解決してから hold する前提とし、この RPC では `available` → `admin_hold` のみ許可する
  - 既に `admin_hold` ならそのまま返す（idempotent）

### `release_table_admin_hold`

- 入力:
  - `p_admin_user_id uuid`
  - `p_table_id uuid`
- 戻り値:
  - `table_status text`
- 補足:
  - `admin_hold → available` への遷移のみ許可する
  - `admin_hold` 以外で呼ばれたら現在状態をそのまま返す（idempotent）

## 3. F-007 前提で必要なこと

F-007 に入る段階では、まだ RPC を実装しなくてよい。
ただし、以後の domain / validator / service の命名はこの文書と整合させる。
