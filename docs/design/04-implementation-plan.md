# 04. 技術スタックと実装計画

## 1. 推奨技術スタック

### 推奨構成

- フロントエンド: Next.js App Router + TypeScript
- UI: shadcn/ui + Tailwind CSS
- バックエンド: Next.js Route Handlers（更新系・状態同期系すべて。Server Actions は使わない）
- DB: PostgreSQL
- BaaS: Supabase
- 状態同期: Supabase Realtime Broadcast を標準とする
- 認証代替:
  - 参加者: 独自セッショントークンを localStorage に保存し、API は `Authorization: Bearer` で送る
  - 運営: パスコード + サーバーセッション
- テスト:
  - ドメインロジック: Vitest
  - API / 状態遷移: Vitest + integration tests
  - E2E最小限: Playwright
- formatter / linter: Biome

### なぜ1週間MVPに向いているか

1. Next.js 1アプリで参加者画面・運営画面・ランキング画面を同居でき、構成が単純
2. Supabase で PostgreSQL と Realtime Broadcast を一元管理でき、状態更新と即時反映を同じ基盤で閉じやすい
3. TypeScript で状態型を厳格化でき、AI実装時の曖昧さを減らせる
4. shadcn/ui により UI を自作しすぎず、スマホ画面中心のMVPを早く組める
5. Route Handlers で API と画面を近い場所に置けるため、AIに分割指示しやすい
6. Biome を formatter / linter の単一系として使うことで、設定が軽く、AI実装時の整形ルールも揃えやすい
7. 多表更新を PostgreSQL 関数 / RPC に寄せることで、複雑なトランザクションをアプリ層へ漏らさずに済む

### 採用しない方がよいもの

- 複雑な OAuth 認証
- フロントとバックエンドの別リポジトリ分割
- 独自WebSocketサーバー
- Redux など大きなクライアント状態管理
- ESLint と Prettier の二重運用
- ブラウザから Supabase テーブル Row をそのまま正本として扱う構成

### 実装上の固定事項

- Supabase 初回投入は [`docs/setup/supabase-bootstrap.md`](../setup/supabase-bootstrap.md) の手順で固定する
- 多表更新は PostgreSQL 関数 / RPC に寄せる
- 状態同期は Realtime Broadcast + authenticated read API 再同期を標準にする

## 1.5 レイアウト実装方針

実装時のUI基準として、ワークスペース内の [layout.pen](../../layout.pen) を参照する。

### 参加者画面

- モバイルファーストで実装する。
- 基本レイアウトは `max-w-md mx-auto` を基準にし、縦1カラムで組む。
- 画面上部に状態表示、中央に現在必要な情報、下部に主操作ボタンを置く。
- 同時に見せる情報量を絞り、カードを積む構成にする。
- `join`, `home`, `match`, `ranking` はすべてスマホ縦持ちで完結する設計にする。
- [layout.pen](../../layout.pen) の参加者向け画面を土台にしつつ、実装時には余白、情報密度、可読性、操作導線をさらにブラッシュアップして最終UIを作る。

### 運営画面

- デスクトップファーストで実装する。
- 基本レイアウトはサイド余白を持つ `max-w-7xl` 相当の横幅で組む。
- ダッシュボードは複数カラムで、卓・参加者・試合を同時表示する。
- テーブルUIとモーダルを前提にし、一覧性を優先する。
- admin の主要画面は 2カラムまたは 3カラムを許容する。
- [layout.pen](../../layout.pen) の admin / monitor 画面を出発点にし、実装時にはPC利用時の一覧性と操作性を高める方向で調整する。

## 2. ディレクトリ構成案

```text
match/
  docs/
    design/
  src/
    app/
      (participant)/
        join/page.tsx
        home/page.tsx
        match/page.tsx
        ranking/page.tsx
      admin/
        layout.tsx
        login/page.tsx
        dashboard/page.tsx
        participants/page.tsx
        matches/page.tsx
        tables/page.tsx
      monitor/
        layout.tsx
        ranking/page.tsx
      api/
        participant/register/route.ts
        participant/session/restore/route.ts
        participant/me/route.ts
        participant/heartbeat/route.ts
        participant/result/ack/route.ts
        matching/start/route.ts
        matching/cancel/route.ts
        match/ready/route.ts
        match/cancel-before-start/route.ts
        match/claim-win/route.ts
        match/approve-result/route.ts
        ranking/route.ts
        admin/login/route.ts
        admin/logout/route.ts
        admin/dashboard/route.ts
        admin/participants/route.ts
        admin/matches/route.ts
        admin/tables/route.ts
        admin/table/force-release/route.ts
        admin/table/hold/route.ts
        admin/table/release-hold/route.ts
        admin/match/resolve/route.ts
        admin/participant/chip-adjust/route.ts
        admin/participant/pause/route.ts
        admin/participant/unpause/route.ts
        admin/participant/disqualify/route.ts
        admin/staff-match/start/route.ts
        admin/staff-match/resolve/route.ts
    components/
      ui/
      participant/
      admin/
      ranking/
    lib/
      db/
        client.ts
        server.ts
        env.ts
        types.ts
      auth/
        participant-session.ts
        admin-session.ts
      api/
        response.ts
      contracts/
        participant-runtime.ts
        ranking.ts
        admin-dashboard.ts
      domain/
        participant-status.ts
        table-status.ts
        match-status.ts
        chip-rules.ts
        state-machine.ts
        disconnect-rules.ts
        errors.ts
      services/
        participant-service.ts
        matching-service.ts
        match-service.ts
        admin-auth-service.ts
        admin-dashboard-service.ts
        admin-participant-service.ts
        admin-match-service.ts
        staff-match-service.ts
        ranking-service.ts
        connection-state-service.ts
      realtime/
        client.ts
        channels.ts
        publisher.ts
      session/
        participant-client-session.ts
      validators/
        participant.ts
        admin.ts
        match.ts
    hooks/
      useParticipantRuntime.ts
      useParticipantRealtime.ts
      useParticipantHeartbeat.ts
      useRankingRealtime.ts
      useAdminDashboardRealtime.ts
    tests/
      unit/
      integration/
      e2e/
  supabase/
    migrations/
    seed.sql
```

補足:

- 多表更新は migration に PostgreSQL 関数を追加し、Route Handler から RPC として呼ぶ
- `src/lib/realtime/*` は必須とし、client subscribe / server publish / channel 名定義をここへ集約する
- `admin-session.ts` は削除せず残し、役割を「DB-backed admin session helper」にする
- DB スキーマ側では `admin_sessions` を `admin_users` と別テーブルで持ち、運営 cookie の正本とする

## 3. 1週間で実装するための開発順序

### Day 1

1. プロジェクト初期化
2. Supabase / PostgreSQL 接続
3. マイグレーション作成
4. seed でイベント1件・卓5件を投入
5. 状態 enum とドメイン型を定義

### Day 2

1. 参加登録API
2. 一意ニックネーム制御
3. 単一セッション制御
4. セッション復元API
5. 参加者ホームの最小画面

### Day 3

1. マッチングサービス
2. 空き卓割当
3. 待機画面
4. マッチ成立画面
5. Realtime Broadcast の最小構成

### Day 4

1. 開始ボタン処理
2. オールイン計算
3. チップ差し引き
4. 対戦中画面
5. キャンセル処理

### Day 5

1. 勝利申告
2. 承認
3. 結果確定
4. ランキング画面
5. モニター表示

### Day 6

1. 運営ログイン
2. ダッシュボード
3. 卓強制解放
4. 勝敗修正
5. チップ修正
6. 一時停止 / 失格
7. 運営戦手動開始

### Day 7

1. 切断復帰調整
2. 例外ケーステスト
3. E2E通し確認
4. 文言調整
5. 当日運用手順メモ作成

## 4. TDD前提の実装方針

AIに実装させる前提で、ドメインロジックから先にテストを書く。

このプロジェクトでは、少なくとも `domain`, `service`, `auth`, `重要 API` はテスト先行を原則とする。
先に失敗するテストを書かずに本実装へ入るのは例外扱いとし、例外は UI の骨組みだけを先に置くタスクに限る。

### 先にユニットテストを書く対象

1. ベット額計算
2. オールイン計算
3. 直前対戦相手回避ロジック
4. 状態遷移ガード
5. 試合結果反映ロジック
6. 接続切れ判定
7. 運営戦ベット計算
8. ランキング整列ルール
9. 承認拒否時の勝利申告クリア処理
10. 運営介入時の復旧先状態決定

### 次に統合テストを書く対象

1. 参加登録からセッション復元
2. 待機開始からマッチ成立
3. 双方開始で試合開始
4. 勝利申告から承認で結果確定
5. 承認拒否で `in_progress` に戻る
6. 開始前キャンセルで卓解放
7. 運営修正の主要操作
8. 運営戦開始から結果確定
9. 旧セッション無効化後の旧端末操作拒否
10. 失格 / 一時停止参加者のマッチング拒否
11. 対戦中失格時の `void_current_match` と `lose_current_match`
12. 結果確定時の `participants`, `matches`, `tables`, `chip_ledger` 整合性
13. `winner_claimed` 状態での二重承認防止
14. `ready` と `cancel-before-start` の競合時の整合性
15. 卓不足時にマッチが作られないこと
16. 切断復帰時に `current_match_id` と状態から正しい画面状態が再構築されること

### E2Eは最小限

1. 参加者2人 + 運営1人の通し
2. 対人戦1試合の完走
3. 失格処理1ケース
4. 再接続後に正しい画面へ戻る1ケース
5. 勝利申告拒否から対戦再開する1ケース

## 4.5 テスト厳密化ポリシー

このプロジェクトでは、テストは「画面が動くこと」ではなく「状態整合性が壊れないこと」を保証するために書く。

最低限、各主要ユースケースで以下を明示的に検証する。

1. `participants.status`
2. `participants.current_match_id`
3. `tables.status`
4. `tables.current_match_id`
5. `matches.status`
6. `matches.winner_claimed_by_participant_id`
7. `matches.winner_participant_id`
8. `participants.chip_balance`
9. `chip_ledger` の行数と `delta`

また、主要 mutation API については、成功系だけでなく少なくとも1件は競合または不正状態の失敗系を入れる。

## 5. Codex / AI駆動開発向けの実装分割方針

### 分割原則

- 1タスク1責務
- DB変更、ドメインロジック、API、画面を一度に混ぜすぎない
- 先に型と状態を固定してから画面へ進む
- 共有レスポンス契約は F-007 で先に固定してから service / API / UI へ広げる
- Realtime は終盤追加ではなく、参加者の状態同期が発生する段階で先に入れる

### タスク一覧

詳細な分割は [`docs/tasks/`](../tasks/README.md) を参照する。

## 6. API責務をAIが迷わないようにするルール

1. 参加者APIは必ず `sessionToken` から本人を解決する
2. UIは bet 額を送らず、サーバーが毎回計算する
3. state 変更は service 層を必ず通す
4. 1エンドポイント1ユースケースにする
5. 画面側は `participant.status` に応じて表示分岐する

## 6.5 実装完了時の共通チェック

各タスク完了時、最低限以下を実行する。

1. `pnpm format`
2. `pnpm lint`
3. `pnpm typecheck`

変更がテスト対象を含む場合は、加えて該当テストも実行する。

1. unit のみなら `pnpm test`
2. E2E を触ったなら `pnpm test:e2e`

## 7. まず最初に作るべき機能

Day 1-7 の開発順序に従い、以下の3機能を最優先とする。

1. 参加登録 + セッション復元
2. マッチング + 卓割当
3. 試合開始 / 勝敗確定 / チップ反映
