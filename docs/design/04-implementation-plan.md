# 04. 技術スタックと実装計画

## 1. 推奨技術スタック

### 推奨構成

- フロントエンド: Next.js App Router + TypeScript
- UI: shadcn/ui + Tailwind CSS
- バックエンド: Next.js Route Handlers / Server Actions
- DB: PostgreSQL
- BaaS: Supabase
- リアルタイム: Supabase Realtime
- 認証代替:
  - 参加者: 独自セッショントークン + httpOnly cookie または localStorage 保持トークン
  - 運営: パスコード + サーバーセッション
- テスト:
  - ドメインロジック: Vitest
  - API / 状態遷移: Vitest + integration tests
  - E2E最小限: Playwright
- formatter / linter: Biome

### なぜ1週間MVPに向いているか

1. Next.js 1アプリで参加者画面・運営画面・ランキング画面を同居でき、構成が単純
2. Supabase で PostgreSQL と Realtime をまとめて使え、リアルタイム実装の負担が小さい
3. TypeScript で状態型を厳格化でき、AI実装時の曖昧さを減らせる
4. shadcn/ui により UI を自作しすぎず、スマホ画面中心のMVPを早く組める
5. Route Handlers / Server Actions で API と画面を近い場所に置けるため、AIに分割指示しやすい
6. Biome を formatter / linter の単一系として使うことで、設定が軽く、AI実装時の整形ルールも揃えやすい

### 採用しない方がよいもの

- 複雑な OAuth 認証
- フロントとバックエンドの別リポジトリ分割
- 独自WebSocketサーバー
- Redux など大きなクライアント状態管理
- ESLint と Prettier の二重運用
- Supabase 初回投入は [`docs/setup/supabase-bootstrap.md`](/Users/kitamurareiki/develop/match/docs/setup/supabase-bootstrap.md) の手順で固定する

## 1.5 レイアウト実装方針

実装時のUI基準として、ワークスペース内の [layout.pen](/Users/kitamurareiki/develop/match/layout.pen) を参照する。

### 参加者画面

- モバイルファーストで実装する。
- 基本レイアウトは `max-w-md mx-auto` を基準にし、縦1カラムで組む。
- 画面上部に状態表示、中央に現在必要な情報、下部に主操作ボタンを置く。
- 同時に見せる情報量を絞り、カードを積む構成にする。
- `join`, `home`, `match`, `ranking` はすべてスマホ縦持ちで完結する設計にする。
- [layout.pen](/Users/kitamurareiki/develop/match/layout.pen) の参加者向け画面を土台にしつつ、実装時には余白、情報密度、可読性、操作導線をさらにブラッシュアップして最終UIを作る。

### 運営画面

- デスクトップファーストで実装する。
- 基本レイアウトはサイド余白を持つ `max-w-7xl` 相当の横幅で組む。
- ダッシュボードは複数カラムで、卓・参加者・試合を同時表示する。
- テーブルUIとモーダルを前提にし、一覧性を優先する。
- admin の主要画面は 2カラムまたは 3カラムを許容する。
- [layout.pen](/Users/kitamurareiki/develop/match/layout.pen) の admin / monitor 画面を出発点にし、実装時にはPC利用時の一覧性と操作性を高める方向で調整する。

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
        login/page.tsx
        dashboard/page.tsx
        participants/page.tsx
        matches/page.tsx
        tables/page.tsx
      api/
        participant/register/route.ts
        participant/session/restore/route.ts
        participant/heartbeat/route.ts
        matching/start/route.ts
        matching/cancel/route.ts
        match/ready/route.ts
        match/cancel-before-start/route.ts
        match/claim-win/route.ts
        match/approve-result/route.ts
        admin/login/route.ts
        admin/table/force-release/route.ts
        admin/match/resolve/route.ts
        admin/participant/chip-adjust/route.ts
        admin/participant/pause/route.ts
        admin/participant/disqualify/route.ts
        admin/staff-match/start/route.ts
    components/
      ui/
      participant/
      admin/
      ranking/
    lib/
      db/
        client.ts
        types.ts
      auth/
        participant-session.ts
        admin-session.ts
      domain/
        participant-status.ts
        table-status.ts
        match-status.ts
        chip-rules.ts
      services/
        participant-service.ts
        matching-service.ts
        match-service.ts
        admin-service.ts
        ranking-service.ts
      realtime/
        channels.ts
        subscriptions.ts
      validators/
        participant.ts
        admin.ts
        match.ts
    tests/
      unit/
      integration/
      e2e/
  supabase/
    migrations/
    seed.sql
```

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
5. リアルタイム購読の最小構成

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
- リアルタイムは最後に薄く差し込む

### AIに実装させるタスク分割例

1. `participants` と `participant_sessions` の migration を作る
2. `tables` と `matches` と `chip_ledger` の migration を作る
3. participant / table / match の status enum を型定義する
4. 参加登録APIとバリデーションを実装する
5. 単一セッション無効化ロジックを実装する
6. セッション復元APIを実装する
7. 参加者ホーム画面を実装する
8. マッチングサービスのユニットテストを書く
9. マッチングサービス本体を実装する
10. 待機開始 / 待機解除APIを実装する
11. マッチ待機画面とマッチ成立画面を実装する
12. ready API とベット計算を実装する
13. 対戦中画面とキャンセル機能を実装する
14. 勝利申告 / 承認APIを実装する
15. ランキング取得APIとランキング画面を実装する
16. Supabase Realtime 購読を参加者画面へ追加する
17. 運営ログインと admin session を実装する
18. 運営ダッシュボードを実装する
19. 卓強制解放 / 勝敗修正 / チップ修正APIを実装する
20. 一時停止 / 失格 / 運営戦開始APIを実装する

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

## 7. まず最初に作るべきタスク一覧

1. Next.js + Supabase + shadcn/ui の初期セットアップ
2. DBスキーマ migration 作成
3. seed でイベント1件・卓5件を用意
4. 参加者状態 / 卓状態 / 試合状態の型定義
5. チップ計算と状態遷移のユニットテスト作成
6. 参加登録APIとセッション復元API実装
7. ホーム画面と参加登録画面の実装
8. マッチングサービス実装
9. 待機画面とマッチ成立画面の実装
10. 開始 / キャンセル / 勝利申告 / 承認API実装
11. ランキング画面実装
12. 運営画面の最小版実装

## 8. この仕様でまず作るべき最初の3機能

1. 参加登録 + セッション復元
2. マッチング + 卓割当
3. 試合開始 / 勝敗確定 / チップ反映
