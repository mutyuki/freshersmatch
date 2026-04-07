# Supabase 初回セットアップ

このファイルは、このリポジトリを Supabase に初回接続するときの手順書です。
Supabase を初めて触る前提で、どの順番で何を押すか、どの SQL をどこに入れるかを固定しています。

## 前提

- Supabase project は作成済み
- `.env.local` に以下の 3 つを設定済み
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- リポジトリの依存関係はインストール済み

## 初回投入で使うファイル

- スキーマ: [`supabase/migrations/0001_init_schema.sql`](/Users/kitamurareiki/develop/match/supabase/migrations/0001_init_schema.sql)
- 初期データ: [`supabase/seed.sql`](/Users/kitamurareiki/develop/match/supabase/seed.sql)

## 手順 1: migration を流す

1. Supabase ダッシュボードを開く
2. 対象 project を開く
3. 左メニューの `SQL Editor` を開く
4. `New query` を押す
5. [`supabase/migrations/0001_init_schema.sql`](/Users/kitamurareiki/develop/match/supabase/migrations/0001_init_schema.sql) の中身を全部貼る
6. `Run` を押す

成功したら、以下のテーブルが作成されます。

- `events`
- `admin_users`
- `participants`
- `participant_sessions`
- `tables`
- `matches`
- `chip_ledger`

この migration では、上記の `public` テーブルすべてで RLS を有効化します。
これは Supabase 公式の推奨に沿った設定です。`public` スキーマにあるテーブルは、RLS を有効にしないと Data API から露出しやすくなります。

## RLS 警告について

Supabase の Security Advisor で `RLS Disabled in Public` と出る場合は、放置しないでください。

今回のアプリでは、最初の実装段階では以下の方針を取ります。

- すべての `public` テーブルで RLS を有効にする
- 参加者ブラウザから DB を直接触らせない
- ブラウザは Next.js の Route Handlers / Server Actions だけを叩く
- サーバー側だけが `service_role` を使って DB を操作する

このため、初期段階では「anon に対する公開 policy」はまだ作りません。
RLS を有効にして policy を作らなければ、ブラウザからの直接アクセスは通らず、安全側に倒せます。

## 手順 2: 管理者パスコードのハッシュを作る

`supabase/seed.sql` の `admin_users.passcode_hash` は仮値です。
seed を流す前に、本番で使う管理者パスコードのハッシュを作って差し替えます。

ターミナルで以下を実行してください。

```bash
pnpm admin:hash 1234
```

`1234` の部分は、当日に運営が使う実際のパスコードに置き換えてください。

出力例:

```text
4d0b...:0c4e...
```

この出力文字列を、[`supabase/seed.sql`](/Users/kitamurareiki/develop/match/supabase/seed.sql) の以下の箇所へそのまま入れます。

```sql
'replace-me-with-a-real-hash'
```

## 手順 3: seed を流す

1. 再度 `SQL Editor` を開く
2. `New query` を押す
3. 更新済みの [`supabase/seed.sql`](/Users/kitamurareiki/develop/match/supabase/seed.sql) を全部貼る
4. `Run` を押す

成功すると、以下が投入されます。

- 会場イベント 1 件
- 管理者ユーザー 1 件
- 卓 5 件

## 手順 4: Supabase 上で確認する

左メニューの `Table Editor` で、以下を順番に確認してください。

1. `events`
   - `venue_code` が `MATCH2026`
   - `status` が `active`
2. `admin_users`
   - `display_name` が `Event Admin`
   - `passcode_hash` が `replace-me-with-a-real-hash` ではない
3. `tables`
   - `table_number` が 1 から 5 まで存在する
   - `status` がすべて `available`

## よくあるつまずき

### migration 実行時にエラーが出る

- すでに一部テーブルが手動作成されている可能性があります
- まず `SQL Editor` のエラーメッセージを確認してください
- 不明なら、そのエラーメッセージをそのまま共有してください

### `RLS Disabled in Public` と出る

- migration 実行前なら正常です
- migration 実行後も出るなら、SQL が途中で失敗している可能性があります
- [`supabase/migrations/0001_init_schema.sql`](/Users/kitamurareiki/develop/match/supabase/migrations/0001_init_schema.sql) を最後まで実行できているか確認してください

### seed 実行時にエラーが出る

- 先に migration が成功していない可能性があります
- `admin_users.passcode_hash` の仮値を置き換えていない可能性があります

### どの値を参加者に見せるのか分からない

- 参加者が入力する会場コードは `events.venue_code` です
- 現在の seed では `MATCH2026` です

## 開発中の運用ルール

- スキーマ変更は必ず `supabase/migrations/` に追加する
- 初期データ変更は `supabase/seed.sql` に反映する
- 手でテーブルを直したら、必ず SQL ファイルにも戻す
- タスク完了時は最低限 `pnpm format`, `pnpm lint`, `pnpm typecheck` を実行する
