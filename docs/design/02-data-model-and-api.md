# 02. データモデル / DBテーブル / API設計

## 1. データモデル概要

MVPで最低限必要な永続データは以下の7系統。

1. イベント設定
2. 参加者
3. 参加者セッション
4. 運営セッション
5. 卓
6. 試合
7. チップ台帳

将来拡張として監査ログを差し込みやすくする。

## 2. 最低限必要なDBテーブル

1. `events`
2. `participants`
3. `participant_sessions`
4. `admin_sessions`
5. `tables`
6. `matches`
7. `chip_ledger`
8. `admin_users`

任意追加:

- `admin_audit_logs`

## 3. 各テーブルの主要カラム

### `events`

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | PK |
| `name` | text | イベント名 |
| `venue_code` | text unique | 会場コード |
| `initial_chip_balance` | integer | 参加登録時に配布する初期チップ |
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
- DB では `partial unique index (participant_id) where is_active = true` を必須にする

### `admin_sessions`

| カラム | 型 | 用途 |
| --- | --- | --- |
| `id` | uuid | セッションID |
| `admin_user_id` | uuid | 対象運営ユーザー |
| `session_token_hash` | text | トークンハッシュ |
| `is_active` | boolean | 現在有効か |
| `issued_at` | timestamptz | 発行時刻 |
| `expires_at` | timestamptz | 有効期限 |
| `invalidated_at` | timestamptz nullable | 無効化時刻 |
| `last_seen_at` | timestamptz | 最終アクセス |

運用ルール:

- cookie には `admin_user_id` を直書きせず、ランダムな opaque token を保持する
- API 側では token を hash 化して `admin_sessions` を参照し、`admin_user_id` を解決する
- `is_active=true` かつ `expires_at > now()` の row のみ有効とする
- 同一 `admin_user_id` に複数 `is_active=true` を許可し、複数端末・複数ブラウザからの同時ログインを阻害しない
- ログアウトは current browser の session row のみ `is_active=false` とし、他端末の session は残す

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
| `table_id` | uuid | 割当卓。MVPでは not null |
| `player1_participant_id` | uuid | 参加者1。MVPでは not null |
| `player2_participant_id` | uuid nullable | 参加者2。運営戦時は null |
| `status` | text | 試合状態 |
| `is_staff_match` | boolean | 運営戦フラグ |
| `staff_operator_id` | uuid nullable | 対応した運営 |
| `player1_ready_at` | timestamptz nullable | 開始押下時刻 |
| `player2_ready_at` | timestamptz nullable | 開始押下時刻 |
| `started_at` | timestamptz nullable | 実際の対戦開始時刻 |
| `agreed_bet_amount` | integer nullable | 実際に賭けた額 |
| `winner_participant_id` | uuid nullable | 勝者 |
| `winner_claimed_by_participant_id` | uuid nullable | 勝利申告者 |
| `winner_claimed_at` | timestamptz nullable | 勝利申告時刻 |
| `dispute_count` | integer | 承認拒否回数（default 0） |
| `last_disputed_at` | timestamptz nullable | 直近の承認拒否時刻 |
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
- 参加者登録時に `events.initial_chip_balance` を `participants.chip_balance` に設定する
- `actual_bet = 0` になる試合は作らない
- MVPでは `chip_balance <= 0` の参加者は待機開始不可とする

## 4.5 ランキングソートルール

MVPのランキングソートは以下で固定する。

1. `chip_balance DESC`
2. `created_at ASC`
3. `participant_id ASC`

補足:

- `updated_at` は heartbeat や状態更新で変動するため使わない
- `created_at` は「先に登録した人を上位」にするタイブレークとして使う
- 表示上は同チップで同順位表示でもよいが、内部ソートは上記で安定化する

## 5. API設計案

更新系・状態同期系はすべて Route Handlers で統一する。Server Actions は使わない。
責務は以下で固定する。

### 参加者向けAPI

1. `POST /api/participant/register`
   - 入力: `venueCode`, `nickname`
   - 処理: 会場コード検証、`venueCode` から `event_id` を解決、ニックネーム一意性確認、既存セッション無効化、新規セッション発行
   - 出力: `participant`, `sessionToken`
2. `POST /api/participant/session/restore`
   - 入力: `sessionToken`
   - 処理: セッション検証、現在状態取得
   - 出力: `participant`, `currentMatch`, `currentTable`
3. `GET /api/participant/me`
   - 入力: `Authorization: Bearer <sessionToken>`
   - 処理: 現在状態取得
   - 出力: `participant`, `currentMatch`, `currentTable`
4. `POST /api/participant/heartbeat`
   - 入力: `Authorization: Bearer <sessionToken>`
   - 処理: `last_seen_at` 更新
5. `POST /api/matching/start`
   - 入力: `Authorization: Bearer <sessionToken>`
   - 処理: `registered -> queueing`、待機キュー再計算
6. `POST /api/matching/cancel`
   - 入力: `Authorization: Bearer <sessionToken>`
   - 処理: `queueing -> registered`
7. `POST /api/match/ready`
   - 入力: `Authorization: Bearer <sessionToken>`, `matchId`
   - 処理: 通常戦では ready 記録、双方 ready ならベット差し引きして `in_progress`。運営戦では参加者1人の ready で `match.status` は `reserved -> in_progress` に直接遷移する（`awaiting_ready` は経由しない）
8. `POST /api/match/cancel-before-start`
   - 入力: `Authorization: Bearer <sessionToken>`, `matchId`
   - 処理: 開始前キャンセル、卓解放、両者復帰
9. `POST /api/match/claim-win`
   - 入力: `Authorization: Bearer <sessionToken>`, `matchId`
   - 処理: 通常戦のみ勝利申告
10. `POST /api/match/approve-result`
   - 入力: `Authorization: Bearer <sessionToken>`, `matchId`, `approve: boolean`
   - 処理: 通常戦のみ。承認なら結果確定、拒否なら `in_progress` に戻す
11. `POST /api/participant/result/ack`
   - 入力: `Authorization: Bearer <sessionToken>`
   - 処理: `result_confirmed -> registered` へ戻し、`participants.current_match_id` を `null` に戻す
12. `GET /api/ranking`
   - 入力: なし
   - 出力: ランキング一覧
   - 補足: 自分の行のハイライトは client 側で `participantId` と突き合わせる
   - 補足: monitor 用 (`/monitor/ranking`) も同じ API を使い、認証不要の公開ページとして表示する

### 運営向けAPI

1. `POST /api/admin/login`
   - 入力: `passcode`
   - 出力: admin session
2. `GET /api/admin/dashboard`
   - 出力: 卓一覧、待機一覧、対戦中一覧、接続切れ一覧
   - 補足: dashboard の初回取得および Realtime invalidation 後の再同期に使う集約 API
3. `POST /api/admin/table/force-release`
   - 入力: `tableId`, `confirm`
   - 処理: 卓を `available` に戻す。必要に応じて関連試合も無効化
4. `POST /api/admin/table/hold`
   - 入力: `tableId`, `confirm`
   - 処理: 空き卓を `admin_hold` にする
5. `POST /api/admin/table/release-hold`
   - 入力: `tableId`, `confirm`
   - 処理: `admin_hold` の卓を `available` に戻す
6. `POST /api/admin/match/resolve`
   - 入力: `matchId`, `winnerParticipantId | void`, `confirm`
   - 処理: 勝敗修正または無効
   - 補足: `void` で開始済み試合（`started_at` / `agreed_bet_amount` が非 `null`）を無効化する場合は、`rollback` reason でベット返却を行い、試合前残高へ戻す
7. `POST /api/admin/participant/chip-adjust`
   - 入力: `participantId`, `delta`, `reason`, `confirm`
   - 処理: 台帳追加、残高更新
8. `POST /api/admin/participant/pause`
   - 入力: `participantId`, `confirm`
9. `POST /api/admin/participant/unpause`
   - 入力: `participantId`, `confirm`
10. `POST /api/admin/participant/disqualify`
   - 入力: `participantId`, `mode`, `reason`, `confirm`
   - `mode`: `void_current_match` または `lose_current_match`
   - `reason`: 失格理由テキスト。DB の `participants.disqualified_reason` に保存される
11. `POST /api/admin/staff-match/start`
   - 入力: `participantId`, `optionalTableId`, `confirm`
   - 処理: 空き卓へ運営戦を作成
   - 補足: 操作者は request body では受け取らず、admin session から解決する
12. `POST /api/admin/staff-match/resolve`
   - 入力: `matchId`, `winnerParticipantId | participantLost`, `confirm`
   - 処理: 運営戦の結果確定
13. `POST /api/admin/logout`
   - 入力: なし
   - 処理: admin session を破棄する
   - 補足: httpOnly cookie を削除し、ログイン画面へ戻す

### セッショントークンの受け渡し契約

MVPでは参加者セッションを以下で固定する。

1. 参加者トークンは `localStorage` に保存する
2. 参加者 API 呼び出し時は `Authorization: Bearer <sessionToken>` を付ける
3. `POST /api/participant/register` と `POST /api/participant/session/restore` は body に `sessionToken` を含めてよい
4. 参加者セッションは httpOnly cookie では持たない

運営セッションは以下で固定する。

1. 運営セッションは httpOnly cookie で保持する
2. cookie の中身は `adminUserId` ではなくランダムな session token にする
3. admin API は cookie から session token を読み、hash 照合で `admin_sessions` を引いて admin session を解決する
4. `POST /api/admin/login` は `admin_users.passcode_hash` 照合後に `admin_sessions` row を発行し、cookie を設定する
5. `POST /api/admin/logout` は current session row を無効化し、cookie を削除する

理由:

- QR 起点のスマホ Web アプリで扱いやすい
- 実装者ごとに cookie / localStorage の方式が割れない
- Realtime invalidation 後の再同期実装を単純に保てる
- 複数運営者や同一運営の複数端末ログインを許可しつつ、現在セッションだけを個別に無効化できる

## 5.5 単一イベント前提の API スコープ

MVP は「active なイベントは1件だけ存在する」前提で実装する。

1. participant 系 API は session から `event_id` を解決する
   - `POST /api/participant/register` は session 未発行のため、`venueCode` から `event_id` を解決する
2. `GET /api/ranking` は active event を参照する
3. monitor 用ランキングも active event をそのまま表示する
4. admin dashboard も active event を前提に集約する

理由:

- 会場用途ではイベント切り替えの複雑さが不要
- participant 側に毎回 `eventId` を持たせなくて済む

## 5.6 共有レスポンス型

UI と service の解釈が割れないよう、以下を共通契約として定義する。

### `ParticipantRuntimeState`

- `participantId: string`
- `eventId: string`
- `nickname: string`
- `status: ParticipantStatus`
- `lastNonDisconnectStatus: ParticipantStatus | null`
- `chipBalance: number`
- `currentMatchId: string | null`
- `queuedAt: string | null`
- `table: { id: string; tableNumber: number; gameTitle: string; status: TableStatus } | null`
- `match: { id: string; status: MatchStatus; isStaffMatch: boolean; agreedBetAmount: number | null; disputeCount: number } | null`
- `opponent: { participantId: string; nickname: string } | null`
- `opponentReady: boolean`
- `winnerParticipantId: string | null`
- `winnerClaimedByParticipantId: string | null`
- `disqualifiedReason: string | null`
- `resultDelta: number | null`
- `resultConfirmedAt: string | null`
- `canStartMatching: boolean`
- `canClaimWin: boolean`

補足:

- `status === 'result_confirmed'` の間は `currentMatchId` を保持する。
- `POST /api/participant/result/ack` 成功時に `currentMatchId` を `null` へ戻す。

#### 派生フィールドの計算ルール

以下のフィールドは DB に永続化せず、service 層で毎回計算して返す。

1. `canStartMatching`
   - `status === 'registered' && chipBalance > 0`
   - `paused`, `disqualified`, `disconnected` では常に `false`
2. `canClaimWin`
   - `status === 'playing' && match !== null && !match.isStaffMatch`
   - 運営戦では参加者側からの勝利申告を許可しないため常に `false`
3. `opponentReady`
   - 通常戦: `match.status === 'awaiting_ready'` かつ自分が `match_reserved` 以外（＝相手が先に ready を押した）
   - 運営戦: 常に `true`（相手参加者がいないため）
4. `resultDelta`
   - `status === 'result_confirmed'` のときのみ値を持つ。それ以外は `null`
   - 計算: `chip_ledger` から `match_id = currentMatchId` の行を取得し、`match_bet` と `match_payout` の `delta` を合算する
   - 例: bet で -100、payout で +200 なら `resultDelta = +100`
5. `resultConfirmedAt`
   - `matches.completed_at` の値をそのまま返す
6. `disqualifiedReason`
   - `status === 'disqualified'` のときのみ文字列を返す
   - それ以外の状態では `null`

### `RankingEntry`

- `participantId: string`
- `nickname: string`
- `chipBalance: number`
- `status: ParticipantStatus`
- `rank: number`

### `AdminDashboardData`

- `eventId: string`
- `tables: Array<{ tableId: string; tableNumber: number; gameTitle: string; status: TableStatus; currentMatchId: string | null; occupantNicknames: string[]; heldByAdminDisplayName: string | null }>`
- `queueingParticipants: Array<{ participantId: string; nickname: string; queuedAt: string; chipBalance: number; isStaffMatchCandidate: boolean }>`
- `inProgressMatches: Array<{ matchId: string; tableNumber: number | null; displayStatus: MatchStatus; participant1Nickname: string; participant2Nickname: string | null; isStaffMatch: boolean; startedAt: string | null }>`
- `disconnectedParticipants: Array<{ participantId: string; nickname: string; lastNonDisconnectStatus: ParticipantStatus | null; lastSeenAt: string }>`
- `disputedMatches: Array<{ matchId: string; tableNumber: number | null; disputeCount: number; lastDisputedAt: string | null }>`
- `stalledMatches: Array<{ matchId: string; tableNumber: number | null; status: MatchStatus; winnerClaimedAt: string | null; startedAt: string | null; participant1Nickname: string; participant2Nickname: string | null }>`

補足:

- `stalledMatches` は `matches.status = 'winner_claimed'` かつ `winner_claimed_at <= now() - interval '120 seconds'` の試合を対象にする
- MVP では停滞判定閾値を `120秒` 固定値として扱う

### admin read 系 service / API 契約

同一アプリ内の admin 一覧ページは、mutation API と別に read 用の service と API を持つ。

admin 個別ページ（participants, matches, tables）は以下の方針で取得する。

- 初回表示: Server Component から read service を直接呼ぶ
- 以後の更新: Client Component は Realtime invalidation を購読し、イベント受信時だけ read API を再取得する
- ダッシュボードは集約 API (`GET /api/admin/dashboard`) を使い、個別ページは下記の専用 read API を使う

admin dashboard も同じ方針で固定する。

- 初回表示: Server Component から `getAdminDashboardData` を直接呼ぶ
- 以後の更新: Client Component は `GET /api/admin/dashboard` を Realtime invalidation 後の再同期専用として使う

#### read service

1. `listAdminParticipants(eventId: string)`
   - 出力: participant 一覧、現在状態、chip_balance、current_match_id、last_seen_at、disqualified_reason
2. `listAdminMatches(eventId: string)`
   - 出力: match 一覧、卓番号、対戦者、status、startedAt 相当、dispute 情報
3. `listAdminTables(eventId: string)`
   - 出力: table 一覧、status、current_match_id、occupantNicknames

#### read API

1. `GET /api/admin/participants`
   - 出力: `listAdminParticipants` と同じ形式
   - 補足: admin participants ページの Realtime 再同期用
2. `GET /api/admin/matches`
   - 出力: `listAdminMatches` と同じ形式
   - 補足: admin matches ページの Realtime 再同期用
3. `GET /api/admin/tables`
   - 出力: `listAdminTables` と同じ形式
   - 補足: admin tables ページの Realtime 再同期用

### `last_opponent_participant_id` の更新ルール

1. 通常対人戦が `completed` したとき、両参加者の `last_opponent_participant_id` を互いに更新する
2. 対人戦を `force_finished_by_admin` で勝敗付き確定したときも更新する
3. `voided_by_admin`, `cancelled_before_start`, 運営戦では更新しない

## 5.7 参加者状態と画面のマッピング

UI実装者が解釈を迷わないよう、以下で固定する。

| `participants.status` | 表示する画面 / パネル | 遷移先ページ |
| --- | --- | --- |
| (セッションなし) | 参加登録画面 | `/join` |
| `registered` | HomePanel | `/home` |
| `queueing` | QueuePanel | `/match` |
| `match_reserved` | MatchReservedPanel | `/match` |
| `ready` | MatchReservedPanel (相手待ち表示) | `/match` |
| `playing` | InProgressPanel | `/match` |
| `claiming_win` | ClaimWaitPanel（承認待ち表示） | `/match` |
| `awaiting_result_approval` | ResultApprovalPanel（承認/拒否ボタン） | `/match` |
| `result_confirmed` | ResultConfirmedPanel | `/match` |
| `paused` | PausedPanel（運営に問い合わせ表示） | `/home` |
| `disqualified` | DisqualifiedPanel（失格表示） | `/home` |
| `disconnected` | 再接続中表示 → 復帰先は `last_non_disconnect_status` で決定 | (状態依存) |

補足:

- ルートページ (`/`) は `'use client'` のクライアントコンポーネントとして実装する。localStorage にトークンがなければ `/join` へリダイレクト、あれば `/api/participant/session/restore` で復元して該当ページへリダイレクトする。復元中はローディングスピナーを全画面表示し、白画面やちらつきを出さない
- 運営戦 (`is_staff_match=true`) では `opponent` が null になるため、UI は「🎮 運営戦です」「卓○番へどうぞ」と表示し、対戦相手欄は「運営スタッフ」と表示する
- `result_confirmed` で ack せず離脱した場合は、再接続時に `result_confirmed` 画面へ復帰させる。MVPでは自動 registered 復帰は行わない
- 画面遷移後の更新は Realtime invalidation で駆動し、Realtime 断時のみ `30秒` 間隔のフォールバック polling を使う

## 6. Realtime 契約

更新通知は WebSocket ベースの Supabase Realtime Broadcast で統一する。

### 基本原則

1. Realtime は「通知」であり「正本データ」ではない
2. 正本データは常に Route Handler 配下の read API が返す
3. mutation が成功したときだけ publish する
4. publish 失敗時でも DB transaction は rollback しない
5. reconnect 後は各画面が一度だけ read API を再取得して整合性を回復する

### channel 例

1. `event:{eventId}:participant`
2. `event:{eventId}:match`
3. `event:{eventId}:ranking`
4. `event:{eventId}:admin`

### event 例

1. `participant.runtime.invalidated`
2. `match.reserved`
3. `match.ready_changed`
4. `match.claimed`
5. `match.completed`
6. `table.released`
7. `ranking.invalidated`
8. `admin.dashboard.invalidated`

### payload 例

```json
{
  "eventType": "match.completed",
  "eventId": "11111111-1111-1111-1111-111111111111",
  "matchId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "participantIds": ["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "cccccccc-cccc-cccc-cccc-cccccccccccc"],
  "occurredAt": "2026-04-08T12:34:56.000Z"
}
```

### read API との結合ルール

1. participant 画面は participant / match / table invalidation を受けたら `/api/participant/me` を再取得する
2. ranking / monitor は ranking invalidation を受けたら `/api/ranking` を再取得する
3. admin dashboard は admin invalidation を受けたら `/api/admin/dashboard` を再取得する
4. admin 個別ページは対象 invalidation を受けたら `/api/admin/participants`, `/api/admin/matches`, `/api/admin/tables` を再取得する

### WebSocket 断時のフォールバック

常時 polling は行わない。ただし、接続断や subscribe 失敗で Realtime が使えない間だけ、read API のフォールバック polling を有効にする。

1. フォールバック polling の間隔は `30秒` で固定する
2. 対象は `participant/me`, `ranking`, `admin/dashboard`, `admin/participants`, `admin/matches`, `admin/tables` とする
3. Realtime reconnect / resubscribe に成功したら、フォールバック polling は即時停止する
4. Realtime reconnect 直後は取りこぼし吸収のため read API を 1 回だけ再取得する
5. フォールバック polling は「接続断中の暫定措置」であり、通常運用では無効のままにする

## 6.2 マッチングサービス責務

APIから切り出して `MatchingService` として実装する。

責務:

1. 待機中参加者を取得する
2. 一時停止・失格・切断を除外する
3. 空き卓を取得する
4. 対戦相手候補をランダム選出する
5. 空き卓候補から卓をランダム選出する
6. 直前対戦相手を可能なら除外する
7. 候補不足なら除外制約を外す
8. 一定待機超過者を運営戦候補として返す
9. `start_queue_and_try_match` RPC に `participant_id / opponent_participant_id / table_id` を組み立てて渡す
10. RPC 実行結果から `ParticipantRuntimeState` を再構築して返す

固定方針:

- 相手候補選定、直前相手回避、運営戦候補判定などの業務ルールは service / domain に置いてよい
- 通常マッチの卓選択も service が担当し、空き卓候補からランダムに 1 卓を選ぶ
- ただし、match / participants / tables の多表更新そのものは `start_queue_and_try_match` RPC を唯一の真実源にする
- RPC は service が選んだ opponent / table を再検証して使い、無効なら代替候補を選ばず queueing 継続に倒す
- service が直接 `match / participants / tables` を個別更新してマッチ成立を作る実装は行わない

## 6.5 セッション責務の固定

参加者セッションは、auth helper と RPC / service で責務を分ける。

1. auth helper の責務
   - raw token 生成
   - token hash 化
   - `Authorization: Bearer` の抽出
   - 既存 `participant_sessions` の hash 照合
   - `last_seen_at` 更新
2. RPC / service の責務
   - 参加登録時の旧セッション無効化
   - 新規 session row の発行
   - `1 participant = 1 active session` を破らない更新

参加登録フローの最終的な session 発行責務は `register_participant_and_issue_session` RPC 側に置く。
auth helper はトークン文字列の生成と検証補助を担い、発行の真実源にはしない。

## 7. トランザクション境界

以下は必ずDBトランザクションにする。

1. 参加登録と旧セッション無効化
2. マッチ成立
3. 試合開始とベット差し引き
4. 結果確定と払い戻し / 配当
5. 開始前キャンセル
6. 運営修正

### 実現方法

MVPでは、上記の多表更新を Next.js から個別クエリで順番に実行しない。
すべて PostgreSQL 関数として `RPC` 化し、1回の DB 呼び出しで完結させる。

MVPで実装する RPC 一覧（`06-rpc-spec.md` と一致させる）:

1. `register_participant_and_issue_session`
2. `start_queue_and_try_match`
3. `cancel_queue`
4. `ready_match`
5. `cancel_match_before_start`
6. `claim_match_win`
7. `approve_match_result`
8. `resolve_match_by_admin`
9. `adjust_participant_chip`
10. `start_staff_match`
11. `resolve_staff_match`
12. `acknowledge_result_confirmed`
13. `pause_participant`
14. `unpause_participant`
15. `disqualify_participant`
16. `force_release_table`
17. `hold_table_by_admin`
18. `release_table_admin_hold`

これにより、アプリ層の責務は「入力検証」「認可」「RPC 呼び出し」に寄せる。

## 7.5 RPC 仕様の固定ルール

詳細な一覧は [`06-rpc-spec.md`](06-rpc-spec.md) を基準とする。

このプロジェクトでは以下を固定する。

1. RPC 名は動詞始まりの snake_case
2. participant を含む更新では、原則 `events -> participants -> matches -> tables` の順にロックを取る
3. 再試行は「競合による serialization failure / row lock conflict」のみ対象とする
4. idempotent 対象は `ready_match`, `claim_match_win`, `approve_match_result`, `resolve_match_by_admin`, `resolve_staff_match`, `pause_participant`, `unpause_participant`, `hold_table_by_admin`, `release_table_admin_hold` とし、二重呼び出し時に二重反映せず現在状態を返す
5. アプリ層は複数テーブル更新を自前で組み立てない

## 8. インデックス・制約

最低限必要なもの:

- `participants(event_id, nickname)` unique
- `participants(event_id, status)`
- `participants(event_id, queued_at)`
- `participants(current_match_id)`
- `participant_sessions(participant_id) where is_active = true` unique
- `events(status) where status='active'` unique
- `matches(player1_participant_id) where status in ('reserved', 'awaiting_ready', 'in_progress', 'winner_claimed')` unique
- `matches(player2_participant_id) where player2_participant_id is not null and status in ('reserved', 'awaiting_ready', 'in_progress', 'winner_claimed')` unique
- `matches(table_id) where status in ('reserved', 'awaiting_ready', 'in_progress', 'winner_claimed')` unique
- `tables(event_id, status)`
- `matches(event_id, status, created_at desc)`
- `chip_ledger(participant_id, created_at desc)`

追加で固定する制約:

- `events.initial_chip_balance >= 0`
- `matches.table_id is not null`
- `matches.player1_participant_id is not null`
- `matches.started_at` / `matches.agreed_bet_amount` は `reserved / awaiting_ready / cancelled_before_start` では両方 `null`
- `matches.started_at` / `matches.agreed_bet_amount` は `in_progress / winner_claimed / completed / force_finished_by_admin` では両方非 `null`
- `matches.status='voided_by_admin'` では、両方 `null`（開始前に無効化）または両方非 `null`（開始後に無効化）のみ許可する（片側のみ `null` は禁止）
- 通常戦では `player2_participant_id is not null`
- 運営戦では `player2_participant_id is null and staff_operator_id is not null`
- `participants.status='disqualified'` のとき `disqualified_reason` は必須、`status <> 'disqualified'` のときは `null` とする

## 9. 将来追加しやすくするポイント

- `chip_ledger` を先に入れておくと、履歴画面や監査ログを足しやすい。
- `matches` に `metadata jsonb` を追加してもよいが、MVPではなくてもよい。
- 0チップ救済は `participants` に `rescue_used_at` を追加すれば拡張しやすい。
