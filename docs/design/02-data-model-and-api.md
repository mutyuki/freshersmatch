# 02. データモデル / DBテーブル / API設計

## 1. データモデル概要

MVPで最低限必要な永続データは以下の6系統。

1. イベント設定
2. 参加者
3. 参加者セッション
4. 卓
5. 試合
6. チップ台帳

将来拡張として監査ログを差し込みやすくする。

## 2. 最低限必要なDBテーブル

1. `events`
2. `participants`
3. `participant_sessions`
4. `tables`
5. `matches`
6. `chip_ledger`
7. `admin_users`

任意追加:

- `admin_audit_logs`

## 3. 各テーブルの主要カラム

### `events`

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | PK |
| `name` | text | イベント名 |
| `venue_code` | text unique | 会場コード |
| `fixed_bet_amount` | integer | 固定ベット額 |
| `staff_match_wait_seconds` | integer | 運営戦候補化までの秒数 |
| `disconnect_threshold_seconds` | integer | 接続切れ判定秒数 |
| `status` | text | `draft / active / closed` |
| `created_at` | timestamptz | 作成日時 |
| `updated_at` | timestamptz | 更新日時 |

### `participants`

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | PK |
| `event_id` | uuid | 所属イベント |
| `nickname` | text | 一意ニックネーム |
| `status` | text | 参加者状態 |
| `last_non_disconnect_status` | text nullable | 切断前状態 |
| `chip_balance` | integer | 現在所持チップ |
| `current_match_id` | uuid nullable | 現在試合 |
| `last_opponent_participant_id` | uuid nullable | 直前対戦相手 |
| `queued_at` | timestamptz nullable | 待機開始時刻 |
| `last_seen_at` | timestamptz | 接続生存確認時刻 |
| `is_paused` | boolean | 一時停止フラグ |
| `is_disqualified` | boolean | 失格フラグ |
| `disqualified_reason` | text nullable | 理由 |
| `created_at` | timestamptz | 作成日時 |
| `updated_at` | timestamptz | 更新日時 |

制約:

- `unique(event_id, nickname)`

### `participant_sessions`

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | セッションID |
| `participant_id` | uuid | 対象参加者 |
| `session_token_hash` | text | トークンハッシュ |
| `is_active` | boolean | 現在有効か |
| `issued_at` | timestamptz | 発行時刻 |
| `invalidated_at` | timestamptz nullable | 無効化時刻 |
| `last_seen_at` | timestamptz | 最終アクセス |

運用ルール:

- 参加者ごとに `is_active=true` は常に1件のみ

### `tables`

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | PK |
| `event_id` | uuid | 所属イベント |
| `table_number` | integer | 卓番号、1-5 固定 |
| `game_title` | text | 卓固定ゲーム名 |
| `status` | text | 卓状態 |
| `current_match_id` | uuid nullable | 現在試合 |
| `held_by_admin_user_id` | uuid nullable | 運営保留中担当者 |
| `created_at` | timestamptz | 作成日時 |
| `updated_at` | timestamptz | 更新日時 |

制約:

- `unique(event_id, table_number)`

### `matches`

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | PK |
| `event_id` | uuid | 所属イベント |
| `table_id` | uuid | 割当卓 |
| `player1_participant_id` | uuid | 参加者1 |
| `player2_participant_id` | uuid nullable | 参加者2。運営戦時は null |
| `status` | text | 試合状態 |
| `is_staff_match` | boolean | 運営戦フラグ |
| `staff_operator_id` | uuid nullable | 対応した運営 |
| `player1_ready_at` | timestamptz nullable | 開始押下時刻 |
| `player2_ready_at` | timestamptz nullable | 開始押下時刻 |
| `agreed_bet_amount` | integer nullable | 実際に賭けた額 |
| `winner_participant_id` | uuid nullable | 勝者 |
| `winner_claimed_by_participant_id` | uuid nullable | 勝利申告者 |
| `winner_claimed_at` | timestamptz nullable | 勝利申告時刻 |
| `completed_at` | timestamptz nullable | 結果確定時刻 |
| `cancelled_by_participant_id` | uuid nullable | 開始前キャンセル者 |
| `void_reason` | text nullable | 試合無効理由 |
| `created_at` | timestamptz | 作成日時 |
| `updated_at` | timestamptz | 更新日時 |

### `chip_ledger`

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | PK |
| `event_id` | uuid | 所属イベント |
| `participant_id` | uuid | 対象参加者 |
| `match_id` | uuid nullable | 紐づく試合 |
| `delta` | integer | 増減 |
| `reason` | text | `match_bet / match_payout / admin_adjustment / rollback` |
| `balance_after` | integer | 反映後残高 |
| `created_by_admin_user_id` | uuid nullable | 運営調整時 |
| `created_at` | timestamptz | 作成日時 |

### `admin_users`

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | PK |
| `display_name` | text | 表示名 |
| `passcode_hash` | text | 管理パスコード |
| `role` | text | `staff / admin` |
| `created_at` | timestamptz | 作成日時 |
| `updated_at` | timestamptz | 更新日時 |

### `admin_audit_logs` 任意

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | PK |
| `admin_user_id` | uuid | 操作者 |
| `event_id` | uuid | 所属イベント |
| `action_type` | text | 操作種別 |
| `target_type` | text | 対象種別 |
| `target_id` | uuid | 対象ID |
| `payload` | jsonb | 詳細 |
| `created_at` | timestamptz | 作成日時 |

## 4. ドメイン上の重要な計算ルール

### 実際のベット額

`actual_bet = min(player1.chip_balance, player2.chip_balance, fixed_bet_amount)`

運営戦時:

`actual_bet = min(player.chip_balance, fixed_bet_amount)`

### チップ反映

通常対人戦:

- 開始時に両者から `-actual_bet`
- 結果確定時に勝者へ `+(actual_bet * 2)`

運営戦:

- 開始時に参加者から `-actual_bet`
- 結果確定時に参加者勝利なら `+actual_bet`
- 参加者敗北なら追加変動なし

補足:

- 運営の無限チップを ledger に持たない
- 対戦結果の純増減だけ参加者側に記録する

## 5. API設計案

HTTP API でも Server Actions でもよいが、責務は以下で固定する。

### 参加者向けAPI

1. `POST /api/participant/register`
   - 入力: `venueCode`, `nickname`
   - 処理: 会場コード検証、ニックネーム一意性確認、既存セッション無効化、新規セッション発行
   - 出力: `participant`, `sessionToken`
2. `POST /api/participant/session/restore`
   - 入力: `sessionToken`
   - 処理: セッション検証、現在状態取得
   - 出力: `participant`, `currentMatch`, `currentTable`
3. `POST /api/participant/heartbeat`
   - 入力: `sessionToken`
   - 処理: `last_seen_at` 更新
4. `POST /api/matching/start`
   - 入力: `sessionToken`
   - 処理: `registered -> queueing`、待機キュー再計算
5. `POST /api/matching/cancel`
   - 入力: `sessionToken`
   - 処理: `queueing -> registered`
6. `POST /api/match/ready`
   - 入力: `sessionToken`, `matchId`
   - 処理: ready 記録、双方 ready ならベット差し引きして `in_progress`
7. `POST /api/match/cancel-before-start`
   - 入力: `sessionToken`, `matchId`
   - 処理: 開始前キャンセル、卓解放、両者復帰
8. `POST /api/match/claim-win`
   - 入力: `sessionToken`, `matchId`
   - 処理: 勝利申告
9. `POST /api/match/approve-result`
   - 入力: `sessionToken`, `matchId`, `approve: boolean`
   - 処理: 承認なら結果確定、拒否なら `in_progress` に戻す
10. `GET /api/ranking`
   - 入力: `eventId`
   - 出力: ランキング一覧
11. `GET /api/participant/me`
   - 入力: `sessionToken`
   - 出力: 自分の状態・チップ・試合情報

### 運営向けAPI

1. `POST /api/admin/login`
   - 入力: `passcode`
   - 出力: admin session
2. `GET /api/admin/dashboard`
   - 出力: 卓一覧、待機一覧、対戦中一覧、接続切れ一覧
3. `POST /api/admin/table/force-release`
   - 入力: `tableId`, `confirm`
   - 処理: 卓を `available` に戻す。必要に応じて関連試合も無効化
4. `POST /api/admin/match/resolve`
   - 入力: `matchId`, `winnerParticipantId | void`, `confirm`
   - 処理: 勝敗修正または無効
5. `POST /api/admin/participant/chip-adjust`
   - 入力: `participantId`, `delta`, `reason`, `confirm`
   - 処理: 台帳追加、残高更新
6. `POST /api/admin/participant/pause`
   - 入力: `participantId`, `confirm`
7. `POST /api/admin/participant/disqualify`
   - 入力: `participantId`, `mode`, `confirm`
   - `mode`: `void_current_match` または `lose_current_match`
8. `POST /api/admin/staff-match/start`
   - 入力: `participantId`, `operatorId`, `optionalTableId`, `confirm`
   - 処理: 空き卓へ運営戦を作成

## 6. マッチングサービス責務

APIから切り出して `MatchingService` として実装する。

責務:

1. 待機中参加者を取得する
2. 一時停止・失格・切断を除外する
3. 空き卓を取得する
4. 対戦相手候補をランダム選出する
5. 直前対戦相手を可能なら除外する
6. 候補不足なら除外制約を外す
7. 一定待機超過者を運営戦候補として返す
8. match / participants / tables を同一トランザクションで更新する

## 7. トランザクション境界

以下は必ずDBトランザクションにする。

1. 参加登録と旧セッション無効化
2. マッチ成立
3. 試合開始とベット差し引き
4. 結果確定と払い戻し / 配当
5. 開始前キャンセル
6. 運営修正

## 8. インデックス・制約

最低限必要なもの:

- `participants(event_id, nickname)` unique
- `participants(event_id, status)`
- `participants(event_id, queued_at)`
- `participants(current_match_id)`
- `tables(event_id, status)`
- `matches(event_id, status, created_at desc)`
- `chip_ledger(participant_id, created_at desc)`

## 9. 将来追加しやすくするポイント

- `chip_ledger` を先に入れておくと、履歴画面や監査ログを足しやすい。
- `matches` に `metadata jsonb` を追加してもよいが、MVPではなくてもよい。
- 0チップ救済は `participants` に `rescue_used_at` を追加すれば拡張しやすい。
