# 00. タスク分解方針

## 1. このタスク定義の目的

- 全く文脈を知らない実装者でも、1タスク単位で着手できるようにする。
- AIと人間が混在しても、ファイル責務と関数責務が衝突しにくいようにする。
- 依存関係を明示し、並列作業できる範囲を最大化する。

## 2. タスク記法

各タスクは以下の形式で書く。

- `タスクID`
- `目的`
- `担当レイヤー`
- `新規作成ファイル`
- `更新ファイル`
- `実装する関数シグネチャ`
- `実装内容`
- `完了条件`
- `依存関係`
- `並列作業メモ`
- `推奨 skill`
- `先に確認するファイル`
- `おすすめプロンプト`

## 3. 依存関係の読み方

- `依存なし`: 単独で開始してよい
- `F-xxx`: 基盤タスク
- `P-xxx`: 参加者フロータスク
- `M-xxx`: マッチフロータスク
- `A-xxx`: 運営・品質タスク

## 4. 共通実装ルール

1. TypeScript は `strict` 前提
2. DBアクセスは `src/lib/services/*` からのみ行う
3. 画面コンポーネントから直接 Supabase クエリを書かない
4. 状態遷移は service 層の関数で一元化する
5. API route は薄く保ち、入力検証と service 呼び出しのみ行う
6. エラーは `AppError` 系に寄せる
7. 重要なドメインロジックは先に Vitest を書く
8. UIは `shadcn/ui` の既存コンポーネントを組み合わせる
9. formatter / linter は Biome を唯一の基準とする

## 4.1 mutation と Realtime の固定ルール

更新系タスクでは、DB更新だけ完了しても「完了」とみなさない。

1. mutation 成功後は `publishInvalidation` まで配線して初めて完了とする
2. publish 失敗で DB transaction を rollback しない方針は設計書どおり維持する
3. 各 mutation タスクでは、どの scope を publish するかを実装時に明示する

最低限の scope 指針:

1. participant 系更新
   - `participant`
2. match 系更新
   - `participant`, `match`, `admin`
3. chip_balance や順位に影響する更新
   - `ranking` を追加する
4. table 状態が変わる更新
   - `admin` を追加する

例:

- `matching/start`, `matching/cancel`, `match/ready`, `match/cancel-before-start`, `match/claim-win`, `match/approve-result`, `participant/result/ack`
  - 少なくとも `participant`
- 結果確定、運営チップ修正、運営勝敗修正、運営戦結果確定
  - `participant`, `admin`, `ranking`
- 卓解放、卓 hold/解除
  - `admin` を含める

## 4.2 TDD の強制ルール

このプロジェクトでは、TDD は「できれば」ではなく、対象タスクでは原則必須とする。

### 必ずテスト先行にする対象

1. `src/lib/domain/*` の純粋関数
2. `src/lib/services/*` の状態変更ロジック
3. `src/lib/auth/*` のセッション制御
4. API の異常系分岐が重要な route
5. 不具合修正タスク全般

### TDD の進め方

1. 先に失敗するテストを書く
2. 最小実装でテストを通す
3. リファクタして重複を減らす
4. 既存要件と状態遷移を壊していないか追加 assertion を入れる

### UI タスクの扱い

- UI 単体は、毎回完全なコンポーネントテストを必須にはしない
- ただし、UI が重要な状態分岐を持つ場合は、その分岐の元になる hook / service / validator を先にテストする
- 参加登録、試合開始、結果承認など主要導線は最終的に integration または E2E で担保する

## 4.5 タスク完了時の必須コマンド

各タスク完了時、最低限以下を実行する。

1. `pnpm format`
2. `pnpm lint`
3. `pnpm typecheck`

テスト対象を含む変更では、さらに以下を実行する。

1. unit / integration を触った場合: `pnpm test`
2. E2E を触った場合: `pnpm test:e2e`

PR前または大きな節目では、可能なら `pnpm build` まで確認する。

## 5. 命名ルール

### ディレクトリ

- `src/app/*`: 画面と API
- `src/components/*`: UI部品
- `src/lib/domain/*`: 純粋関数と enum
- `src/lib/services/*`: DBを使うユースケース
- `src/lib/auth/*`: セッション処理
- `src/lib/validators/*`: zod スキーマ

### 関数

- APIハンドラから呼ぶ関数は `executeXxx`
- DB検索は `findXxx` / `listXxx`
- 状態変更は `transitionXxx` / `completeXxx` / `cancelXxx`
- チップ計算は `calculateXxx`

## 6. 優先度

- 最優先: 参加登録、マッチング、試合開始、結果確定
- 次点: ランキング、運営画面、切断復帰
- 後段: 監査ログ、運用補助文書

## 7. AI に渡すときの共通テンプレート

各タスクの `おすすめプロンプト` はそのまま使ってよい。
より安定させたいときは、末尾に以下を追加する。

- 「勝手に要件を広げず、指定ファイルだけを主対象にしてください」
- 「着手前に依存関係を確認してください」
- 「対象が domain / service / auth / 重要 API の場合は、必ず先に失敗するテストを書いてから実装してください」
- 「完了時は `pnpm format`, `pnpm lint`, `pnpm typecheck` を実行してください」
- 「テスト対象を含む場合は `pnpm test`、E2E を含む場合は `pnpm test:e2e` も実行してください」
- 「`layout.pen` を参考にしつつ、そのまま写経せずに可読性と操作性をブラッシュアップしてください」
