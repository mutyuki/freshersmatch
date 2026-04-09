# 01. 状態遷移とリアルタイム設計

## 1. 設計方針

- 破綻しにくさを優先し、参加者状態・卓状態・試合状態を分けて持つ。
- 画面表示は常にサーバー状態を正とし、クライアント側は一時的なUI状態のみ持つ。
- 状態更新は「1回のサーバー処理で関連する行をまとめて更新」し、不整合を減らす。
- 多表更新は DB 関数 / RPC で閉じ、アプリ側で複数クエリを直列実行しない。
- 同期は「状態変更の即時反映」を目標とし、MVPでも WebSocket ベースの Realtime を採用する。
- ブラウザは DB 行そのものを直接信頼せず、Realtime では「何が変わったか」の通知だけを受け取り、正本データは認証済み API から再取得する。

## 2. 参加者の状態一覧

`participants.status`

1. `unregistered`
   - まだ参加確定していない
2. `registered`
   - 参加済み、ホーム待機中
3. `queueing`
   - マッチ待機中
4. `match_reserved`
   - マッチ成立済み、卓仮予約済み、開始前
5. `ready`
   - 開始ボタンを押したが相手待ち
6. `playing`
   - 双方開始済み、対戦中
7. `claiming_win`
   - 自分が勝利申告中
8. `awaiting_result_approval`
   - 相手の勝利申告への対応待ち
9. `result_confirmed`
   - 結果確定直後の一時状態
10. `paused`
   - 一時停止中、マッチング不可
11. `disqualified`
   - 失格、ランキングでは失格表示
12. `disconnected`
   - 30秒以上通信がなく接続切れ扱い

補足:

- `result_confirmed` は参加者が結果表示を確認するための短い一時状態で、`POST /api/participant/result/ack` 成功時に `registered` へ戻す。
- `result_confirmed` 中は `participants.current_match_id` を保持し、`POST /api/participant/result/ack` 成功時に `null` へ戻す。
- 参加者の一時停止・失格は `status` だけで表現し、`is_paused` や `is_disqualified` のような二重フラグは持たない。
- `disconnected` は状態として扱うが、復帰先は `last_non_disconnect_status` を使って戻す。

## 3. 卓の状態一覧

`tables.status`

1. `available`
   - 空き
2. `reserved`
   - マッチ成立済み、開始前の仮予約
3. `in_use`
   - 使用中
4. `admin_hold`
   - 運営介入中。強制解放や修正作業のため、一時的に新規割当しない

## 4. 試合の状態一覧

`matches.status`

1. `reserved`
   - マッチ成立、卓割当済み、開始前
2. `awaiting_ready`
   - 少なくとも片方が開始ボタンを押した
3. `in_progress`
   - 双方開始済み
4. `winner_claimed`
   - 勝者申告済み、敗者承認待ち
5. `completed`
   - 結果確定済み
6. `cancelled_before_start`
   - 開始前キャンセル
7. `voided_by_admin`
   - 運営により無効化
8. `force_finished_by_admin`
   - 運営により勝敗付きで終了

## 5. 参加者状態遷移

### 基本遷移

- `unregistered -> registered`
  - 参加登録成功
- `registered -> queueing`
  - マッチング開始
- `queueing -> match_reserved`
  - 対人または運営戦でマッチ成立
- `match_reserved -> ready`
  - 自分のみ開始ボタン押下
- `match_reserved -> playing`
  - 相手が先に ready で、自分が開始ボタン押下して双方準備完了
- `ready -> playing`
  - 相手も開始ボタン押下
- `match_reserved -> playing`
  - 運営戦で参加者が開始ボタンを押下したとき。参加者APIとしては ready を呼ぶが、participant.status は `ready` を経由せず `match_reserved -> playing` へ遷移する
- `playing -> claiming_win`
  - 自分が勝利申告
- `playing -> awaiting_result_approval`
  - 相手が勝利申告
- `claiming_win -> playing`
  - 相手が承認拒否
- `awaiting_result_approval -> playing`
  - 自分が承認拒否
- `claiming_win -> result_confirmed`
  - 相手が承認
- `awaiting_result_approval -> result_confirmed`
  - 自分が承認
- `result_confirmed -> registered`
  - `result ack` 成功
- `playing -> result_confirmed`
  - 運営戦で運営が結果確定

### 例外遷移

- `match_reserved -> registered`
  - 開始前キャンセル
- `ready -> registered`
  - 相手または自分が開始前キャンセル
- `queueing -> registered`
  - 待機解除
- `paused -> registered`
  - 運営による一時停止解除
- `* -> paused`
  - 運営による一時停止
- `* -> disqualified`
  - 運営による失格
- `registered|queueing|match_reserved|ready|playing -> disconnected`
  - `last_seen_at` 超過
- `disconnected -> 元の進行状態`
  - 再接続成功時。元状態は `last_non_disconnect_status` で復元する

## 6. 卓状態遷移

- `available -> reserved`
  - マッチ成立
- `reserved -> in_use`
  - 双方開始
- `reserved -> available`
  - 開始前キャンセル
- `in_use -> available`
  - 結果確定
- `available -> admin_hold`
  - 運営が卓を保留化
- `admin_hold -> available`
  - 運営が解放

補足:

- `reserved` / `in_use` の卓を `admin_hold` にしたい場合は、先に match を解決して `available` へ戻してから hold する（`hold_table_by_admin` は `available -> admin_hold` のみ許可）。

## 7. 試合状態遷移

- `reserved -> awaiting_ready`
  - 片方が開始
- `reserved -> in_progress`
  - 運営戦のみ。参加者1人の ready で開始し、`awaiting_ready` は経由しない
- `awaiting_ready -> in_progress`
  - 双方開始、ベット差し引き成功
- `reserved|awaiting_ready -> cancelled_before_start`
  - 開始前キャンセル
- `in_progress -> winner_claimed`
  - 勝者申告
- `winner_claimed -> in_progress`
  - 承認拒否
- `winner_claimed -> completed`
  - 承認成功、チップ反映
- `reserved|awaiting_ready|in_progress|winner_claimed -> voided_by_admin`
  - 無効試合
- `in_progress|winner_claimed -> force_finished_by_admin`
  - 運営が勝敗確定

## 8. 状態遷移設計上の重要ルール

1. ベット差し引きは通常戦では `awaiting_ready -> in_progress`、運営戦では `reserved -> in_progress` の瞬間のみ行う。
2. チップ反映は `winner_claimed -> completed` または `force_finished_by_admin` のときのみ行う。
3. `cancelled_before_start` ではチップを触らない。
4. `winner_claimed -> in_progress` に戻すときは勝利申告者IDをクリアする。
5. 運営戦成立後は差し替えないので、`is_staff_match=true` になった match は通常候補へ戻さない。
6. 同一参加者が同時に複数 active match に属さないよう、`participants.current_match_id` を単一管理する。`result_confirmed` 中は直前試合IDを保持し、`POST /api/participant/result/ack` で `null` へ戻す。
7. 運営戦では `player2_participant_id` を持たず、参加者1人だけが `ready` を押せば開始できる。
8. 運営戦では参加者側の勝利申告 / 承認 UI を使わず、運営の結果確定で終了する。
9. `last_opponent_participant_id` は通常対人戦の `completed` と、対人戦の `force_finished_by_admin` でのみ更新する。
10. `voided_by_admin`, `cancelled_before_start`, 運営戦では `last_opponent_participant_id` を更新しない。

## 9. 状態同期の設計方針

### 即時反映が必要な画面

1. 参加者ホーム画面
   - チップ数
   - 参加状態
2. マッチ待機画面
   - マッチ成立
   - 待機解除反映
3. マッチ成立画面
   - 相手の開始ボタン状態
   - キャンセル
4. 対戦中画面
   - 勝利申告発生
5. 承認確認画面
   - 承認対象到着
6. 結果確定画面
   - チップ更新
   - ランキング更新
7. ランキング画面 / モニター画面
   - 順位更新
8. 運営ダッシュボード
   - 卓状態
   - 待機人数
   - 対戦中一覧
   - 接続切れ一覧

### 即時反映が必要なイベント

1. participant 更新
   - 状態変更
   - チップ変動
   - 接続状態変更
2. match 更新
   - 作成
   - 開始
   - 勝利申告
   - 承認拒否
   - 結果確定
   - キャンセル
   - 運営介入
3. table 更新
   - 予約
   - 使用開始
   - 解放
   - 運営保留
4. ranking 対象データ更新
   - participant chip_balance 更新をランキング一覧で購読

### MVP の通信方式

- サーバー状態更新は Route Handlers で行う（Server Actions は使わない）。
- UI反映は Supabase Realtime Broadcast を標準とする。
- ブラウザは `event:{eventId}:participant`, `event:{eventId}:match`, `event:{eventId}:ranking`, `event:{eventId}:admin` などの Broadcast channel を購読する。
- mutation 成功後は Route Handler または service が Broadcast event を publish する。
- クライアントは受信した event 種別に応じて必要な read API だけを再取得する。
- `participant/me`, `ranking`, `admin/dashboard` は初回ロードと Realtime invalidation 後の再同期に使う。
- 常時 polling は行わない。Realtime が正常な間は event 駆動のみで再同期し、接続断や subscribe 失敗時だけ `30秒` 間隔のフォールバック polling を有効化する。resubscribe 成功後は即時停止する。

### なぜ Realtime Broadcast を標準にするか

1. マッチ成立、ready、勝利申告、結果確定を即時に反映できる
2. `2-3秒` 遅延を UX 上の仕様にしなくて済む
3. canonical state は API のまま維持でき、WebSocket 側には機密データを流し込まなくてよい
4. Broadcast payload を invalidation 中心にすれば、認可とデータ整合性の責務を分離できる
5. 更新は RPC / Route Handler、反映は Realtime という役割分離が明快になる

### Realtime event 方針

1. payload には機密データを載せすぎず、`eventType`, `eventId`, `participantId`, `matchId`, `tableId`, `version`, `occurredAt` など最小限に絞る
2. 参加者は event invalidation を受けたら `/api/participant/me` を再取得する
3. ランキング画面と monitor は ranking invalidation を受けたら `/api/ranking` を再取得する
4. admin は admin / match / table invalidation を受けたら `/api/admin/dashboard` または該当 read API を再取得する
5. reconnect 後は subscribe 完了時に一度だけ read API を再取得して取りこぼしを吸収する

### 再接続時の挙動

1. クライアント起動時にセッショントークンを送信
2. サーバーは participant を取得
3. `current_match_id` と `status` を返す
4. クライアントは状態別画面に復帰
5. `disconnected` だった場合は `last_non_disconnect_status` に戻す

### 切断状態の永続化責務

1. `last_non_disconnect_status` は `status != disconnected` の participant が進行状態を更新するときだけ更新する
2. `heartbeat` 自体では `last_non_disconnect_status` を更新しない
3. `participant/me`, `participant/session/restore`, `admin/dashboard` 取得前に接続状態の整合性補正を走らせる
4. `last_seen_at` 超過で進行中 participant を `disconnected` へ遷移させる責務は service 層に置く
5. 再接続時の復帰責務も service 層に置き、UI は返ってきた `status` に従って画面を切り替える

## 10. 進行不能を防ぐための簡略ルール

- どの進行停止も運営画面から解除できることを優先する。
- 参加者の自動救済より「運営が見えること」と「手で直せること」を優先する。
- クライアントでの楽観更新は最小限にする。
