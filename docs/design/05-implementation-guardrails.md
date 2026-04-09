# 05. 実装前に固定する判断

この文書は、初回設計で曖昧だった箇所を「実装の前提」として固定するための補足である。
ここに書いた内容は、以後の実装・タスク分解・レビューの基準とする。

## 1. 初期チップ配布

- 参加登録直後に全員が対戦できるよう、イベント設定に `initial_chip_balance` を持つ
- 参加登録時に `participants.chip_balance = events.initial_chip_balance` を設定する
- MVPではこの値を seed でも投入する

### 理由

- 初期チップがないと、登録直後に全員が 0 チップになりゲームが成立しない
- イベントごとに調整したいため、コード定数ではなく DB 設定に置く

## 2. 状態の真実源

- `participants.status` を唯一の真実源にする
- `paused`, `disqualified`, `disconnected` はすべて `status` で表す
- `is_paused`, `is_disqualified` のような重複フラグは持たない
- 例外として、`last_non_disconnect_status` だけは再接続復帰のために持つ

### 理由

- 一覧表示、マッチング除外、ランキング表示、運営画面の判断がすべて `status` で完結する
- 二重管理をすると service ごとに分岐条件がずれやすい

## 3. ランキングのタイブレーク

- ランキングは `chip_balance DESC, created_at ASC, participant_id ASC`
- `updated_at` はタイブレークに使わない

### 理由

- `updated_at` は heartbeat や状態更新でも動くため、公平性が壊れる
- `created_at` なら「先に登録した人が上位」という分かりやすいルールになる

## 4. 状態同期方式

- 画面同期は Supabase Realtime Broadcast を標準とする
- ブラウザから `public` テーブル Row を直接正本として扱わない
- Broadcast payload は invalidation を中心にし、画面は必要な read API を再取得して整合性を合わせる
- 参加者画面は participant / match invalidation を受けたら `GET /api/participant/me` を再取得する
- ランキング画面と monitor は ranking invalidation を受けたら `GET /api/ranking` を再取得する
- admin dashboard は admin invalidation を受けたら `GET /api/admin/dashboard` を再取得する
- Realtime が切断中または subscribe 失敗中のみ、`30秒` 間隔のフォールバック polling を許可する
- reconnect / resubscribe 成功後はフォールバック polling を停止し、read API を 1 回だけ再取得する
- reconnect 後は subscribe 完了時に一度だけ再取得する

### 理由

- マッチングアプリでは反映遅延自体が UX 劣化と誤操作の温床になる
- 変更通知を socket、正本データを read API に分離すると整合性と可観測性を両立できる
- 常時 periodic polling を仕様にしないことで、負荷・遅延・無駄な再取得を減らせる

## 5. トランザクション方式

- 多表更新を含むユースケースは PostgreSQL 関数 / Supabase RPC で実装する
- Next.js の service から複数クエリを順番に実行して整合性を作らない

### RPC化する対象

1. 参加登録 + 旧セッション無効化 + 新セッション発行
2. queue 開始 + マッチ試行
3. queue 解除
4. ready 処理
5. 開始前キャンセル
6. 勝利申告
7. 承認 / 承認拒否
8. 通常戦結果確定
9. 運営修正
10. 運営戦開始
11. 運営戦結果確定

### 理由

- マッチ、参加者、卓、台帳の複数行更新を1トランザクションに閉じられる
- 同時押下や競合時に DB を最終判断者にできる

## 6. 運営戦のライフサイクル

運営戦は通常戦と同じ UI を一部共有するが、状態遷移は完全には同じにしない。

### match の持ち方

- `is_staff_match = true`
- `player1_participant_id = 参加者`
- `player2_participant_id = null`
- `staff_operator_id = 対応する運営`

### 開始

- 参加者1人の `ready` で `in_progress` に入れる
- 開始時に参加者からだけ `actual_bet` を引く

### 結果確定

- 参加者側の `claim-win` / `approve-result` は使わない
- 実物ゲーム終了後、運営画面から結果を確定する
- 参加者勝利なら `+actual_bet`
- 参加者敗北なら追加加算なし

### 理由

- 運営戦には「相手参加者」がいないため、通常戦の承認フローを流用できない
- 運営がその場にいるため、運営確定のほうが単純で安全

## 7. DB制約の固定方針

- `events.initial_chip_balance >= 0`
- `participant_sessions` は `partial unique index (participant_id) where is_active = true` を持つ
- `events` は `status='active'` を 1 件だけ許す partial unique index を持つ
- `matches.table_id` は not null
- `matches.player1_participant_id` は not null
- `matches.dispute_count >= 0`
- `matches.started_at` / `matches.agreed_bet_amount` は開始前状態では null、開始済み状態では非 null の整合制約を持つ
- `matches(player1_participant_id / player2_participant_id / table_id)` は active match 状態で partial unique index を持つ
- `matches.table_id` と `matches.player1_participant_id` の FK は `on delete restrict` に寄せる
- 通常戦では `player2_participant_id` は not null
- 運営戦では `player2_participant_id is null and staff_operator_id is not null`

### 理由

- アプリ層の if 文だけに整合性を任せない
- 壊れた行を DB 自体が拒否できるようにする

## 7.5 セッション発行責務

- 参加登録時の旧セッション無効化と新規 session row 発行は RPC で完結させる
- auth helper は raw token 生成、hash 化、verify、touch を担当する
- auth helper で session row 発行ロジックを重複実装しない

### 理由

- 発行責務を 1 箇所に寄せないと service / auth / RPC で挙動が割れる
- 単一セッション制御は DB 制約と RPC 更新で最終保証した方が安全

## 8. APIの整理方針

MVPでは、更新系・状態同期系はすべて Route Handlers で統一する。Server Actions は使わない。
API 仕様の正本は [`02-data-model-and-api.md`](02-data-model-and-api.md) に置く。

### 参加者

- 参加者トークンは `localStorage` に保存する
- 参加者 API は `Authorization: Bearer <sessionToken>` で送る
- `POST /api/participant/session/restore`
  - アプリ起動直後のブートストラップ
- `GET /api/participant/me`
  - 初回復元およびRealtimeイベント受信時の画面再同期
- `POST /api/participant/result/ack`
  - 結果表示を閉じて `registered` へ戻す
- participant client は Realtime subscribe を必須とし、socket event 受信時だけ `me` を再取得する

### admin

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/dashboard`
- `GET /api/admin/participants`
- `GET /api/admin/matches`
- `GET /api/admin/tables`
- `POST /api/admin/table/force-release`
- `POST /api/admin/table/hold`
- `POST /api/admin/table/release-hold`
- `POST /api/admin/match/resolve`
- `POST /api/admin/participant/chip-adjust`
- `POST /api/admin/participant/pause`
- `POST /api/admin/participant/unpause`
- `POST /api/admin/participant/disqualify`
- `POST /api/admin/staff-match/start`
- `POST /api/admin/staff-match/resolve`
- admin client は dashboard / participants / matches / tables の各画面で Realtime subscribe を必須とし、socket event 受信時だけ read API を再取得する

### monitor

- monitor 用ランキング (`/monitor/ranking`) は admin 認証不要の公開ページとする
- 会場モニターに映す用途のため、admin layout とは独立した layout を持つ
- ranking invalidation を受けた時だけ `GET /api/ranking` を再取得する

### 理由

- `restore` と `me` を分けると、初回復元と Realtime 後の再同期の責務が明確になる
- `unpause` を独立APIにすると、運営操作が UI と service で分かりやすい
- admin 個別ページ（participants, matches, tables）に read API を用意することで、初回 SSR 後は Realtime invalidation だけで新鮮さを保てる

## 8.5 単一イベント前提

- MVP は単一 active event 前提で実装する
- 参加者APIは session から `event_id` を解決する
- ranking / admin dashboard / monitor は active event を1件取得して使う
- UI から `eventId` を自由入力させない

### 理由

- 会場内イベント用途では複数イベント同時運用を考えなくてよい
- participant session と ranking API の event 文脈を固定すると実装解釈が割れにくい
