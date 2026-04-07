# 01. 状態遷移とリアルタイム設計

## 1. 設計方針

- 破綻しにくさを優先し、参加者状態・卓状態・試合状態を分けて持つ。
- 画面表示は常にサーバー状態を正とし、クライアント側は一時的なUI状態のみ持つ。
- 状態更新は「1回のサーバー処理で関連する行をまとめて更新」し、不整合を減らす。
- リアルタイムは「状態変更の即時反映」に限定し、複雑なP2P通信は採用しない。

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

- `result_confirmed` は画面遷移直後に短く使い、その後 `registered` に戻してよい。
- `disconnected` は独立フラグでも実装できるが、MVPでは状態として表現した方が運営画面で扱いやすい。

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
  - 結果表示後

### 例外遷移

- `match_reserved -> registered`
  - 開始前キャンセル
- `ready -> registered`
  - 相手または自分が開始前キャンセル
- `queueing -> registered`
  - 待機解除
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
- `reserved|in_use -> admin_hold`
  - 運営介入
- `admin_hold -> available`
  - 運営が解放

## 7. 試合状態遷移

- `reserved -> awaiting_ready`
  - 片方が開始
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
- `reserved|awaiting_ready|in_progress|winner_claimed -> force_finished_by_admin`
  - 運営が勝敗確定

## 8. 状態遷移設計上の重要ルール

1. ベット差し引きは `awaiting_ready -> in_progress` の瞬間のみ行う。
2. チップ反映は `winner_claimed -> completed` または `force_finished_by_admin` のときのみ行う。
3. `cancelled_before_start` ではチップを触らない。
4. `winner_claimed -> in_progress` に戻すときは勝利申告者IDをクリアする。
5. 運営戦成立後は差し替えないので、`is_staff_match=true` になった match は通常候補へ戻さない。
6. 同一参加者が同時に複数 match に属さないよう、`participants.current_match_id` を単一管理する。

## 9. リアルタイム通信の設計方針

### リアルタイム更新が必要な画面

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

### リアルタイム更新が必要なイベント

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

### 通信方式

- サーバー状態更新は HTTP API / Server Action で行う。
- UI反映は Supabase Realtime か WebSocket 購読で行う。
- MVPでは「双方向カスタムイベント」を避け、DB更新の購読ベースに寄せる。

### 再接続時の挙動

1. クライアント起動時にセッショントークンを送信
2. サーバーは participant を取得
3. `current_match_id` と `status` を返す
4. クライアントは状態別画面に復帰
5. `disconnected` だった場合は `last_non_disconnect_status` に戻す

## 10. 進行不能を防ぐための簡略ルール

- どの進行停止も運営画面から解除できることを優先する。
- 参加者の自動救済より「運営が見えること」と「手で直せること」を優先する。
- クライアントでの楽観更新は最小限にする。
