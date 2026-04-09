# Match

新入生歓迎会向けの「1対1カードゲーム用マッチングWebアプリ」の実装リポジトリです。

## Tech Stack

- Next.js App Router + TypeScript
- Supabase (PostgreSQL, Realtime Broadcast)
- shadcn/ui + Tailwind CSS v4
- Biome
- Vitest / Playwright

## セットアップ

1. 依存関係をインストール

```bash
pnpm install
```

2. 環境変数を設定

- `.env.example` を元に `.env.local` を作成
- 以下を設定
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

3. Supabase 初期化

- 手順は `docs/setup/supabase-bootstrap.md` に従ってください
- migration は `0001_init_schema.sql` を実行
- `supabase/seed.sql` を実行

4. 開発サーバー起動

```bash
pnpm dev
```

## 主なコマンド

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm format
pnpm test
pnpm test:e2e
```

管理者パスコードハッシュ生成:

```bash
pnpm admin:hash <passcode>
```

## ドキュメント

- 設計: `docs/design/README.md`
- タスク分解: `docs/tasks/README.md`
- テスト方針: `docs/testing/test-matrix.md`
