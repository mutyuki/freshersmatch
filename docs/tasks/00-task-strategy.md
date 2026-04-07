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
