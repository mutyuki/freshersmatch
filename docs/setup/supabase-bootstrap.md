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

- スキーマ: [`supabase/migrations/0001_init_schema.sql`](../../supabase/migrations/0001_init_schema.sql)
- 初期データ: [`supabase/seed.sql`](../../supabase/seed.sql)

補足:

- `0001` はテーブル、主要制約、guardrail 整合まで含んだ初期スキーマです
- 今後の RPC 実装などは `0003` 以降の別 migration として追加し、既存 schema migration を書き換えない前提で進めます

## 手順 1: migration を流す

1. Supabase ダッシュボードを開く
2. 対象 project を開く
3. 左メニューの `SQL Editor` を開く
4. `New query` を押す
5. [`supabase/migrations/0001_init_schema.sql`](../../supabase/migrations/0001_init_schema.sql) の中身を全部貼る
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
- ブラウザは Next.js の Route Handlers だけを叩く
- サーバー側だけが `service_role` を使って DB を操作する

このため、初期段階では「anon に対する公開 policy」はまだ作りません。
RLS を有効にして policy を作らなければ、ブラウザからの直接アクセスは通らず、安全側に倒せます。

## 手順 1.5: Realtime Broadcast の前提を確認する

このアプリは短周期 polling を使わず、Supabase Realtime Broadcast を前提に状態同期します。

- 使用するのは `Postgres Changes` の行購読ではなく `Broadcast` です
- 参加者ブラウザが `public` テーブルを直接 subscribe する設計にはしません
- サーバー側の Route Handler / service が mutation 成功後に invalidation event を publish し、ブラウザはその通知を受けて認証済み read API を再取得します

確認ポイント:

1. Supabase ダッシュボードの `Realtime` が project で有効になっている
2. 実装時に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を使ってブラウザ側 realtime client を作れる
3. server 側 publish helper では service role で Broadcast を送る設計にする

補足:

- Broadcast 採用のため、`Database > Replication` で各テーブルの change feed を個別に有効化する前提は置きません
- Realtime は通知チャネルであり、状態の正本はあくまで Route Handler 経由の read API です

## 手順 2: 管理者パスコードのハッシュを作る

`supabase/seed.sql` には開発用ハッシュがすでに入っています。
ローカル確認だけならそのままでも動きますが、実運用や共有環境で使う前には必ず本番用の管理者パスコードへ差し替えてください。

ターミナルで以下を実行してください。

```bash
pnpm admin:hash 1234
```

`1234` の部分は、当日に運営が使う実際のパスコードに置き換えてください。

出力例:

```text
4d0b...:0c4e...
```

この出力文字列で、[`supabase/seed.sql`](../../supabase/seed.sql) に入っている `admin_users.passcode_hash` の値を置き換えます。

## 手順 3: seed を流す

1. 再度 `SQL Editor` を開く
2. `New query` を押す
3. 更新済みの [`supabase/seed.sql`](../../supabase/seed.sql) を全部貼る
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
   - `passcode_hash` が、自分で設定した管理者パスコードのハッシュになっている
3. `tables`
   - `table_number` が 1 から 5 まで存在する
   - `status` がすべて `available`

## よくあるつまずき

### migration 実行時にエラーが出る

- すでに一部テーブルが手動作成されている可能性があります
- まず `SQL Editor` のエラーメッセージを確認してください
- 不明なら、そのエラーメッセージをそのまま共有してください

### すでに 0001 を流したあとで schema を更新したい

- 既存 schema を編集して上書きするのではなく、新しい migration を `0003` 以降に追加してください
- 既存環境に差分を反映するときは、その新しい migration だけを順番どおり適用してください

### `RLS Disabled in Public` と出る

- migration 実行前なら正常です
- migration 実行後も出るなら、SQL が途中で失敗している可能性があります
- [`supabase/migrations/0001_init_schema.sql`](../../supabase/migrations/0001_init_schema.sql) を最後まで実行できているか確認してください

### Realtime はつながるが画面が更新されない

- client 側 subscribe はできていても、server 側で Broadcast publish を呼んでいない可能性があります
- まず mutation 成功後に invalidation event を publish しているか確認してください
- 次に、受信後に `participant/me`, `ranking`, `admin/dashboard` などの read API を再取得しているか確認してください
- Broadcast を使う設計なので、`Postgres Changes` の replication 設定不足を疑う前に publish / subscribe 実装を確認してください

### seed 実行時にエラーが出る

- 先に migration が成功していない可能性があります
- `admin_users.passcode_hash` を本番用へ差し替え忘れている可能性があります

### どの値を参加者に見せるのか分からない

- 参加者が入力する会場コードは `events.venue_code` です
- 現在の seed では `MATCH2026` です

## 開発中の運用ルール

- スキーマ変更は必ず `supabase/migrations/` に追加する
- 初期データ変更は `supabase/seed.sql` に反映する
- 手でテーブルを直したら、必ず SQL ファイルにも戻す
- タスク完了時は最低限 `pnpm format`, `pnpm lint`, `pnpm typecheck` を実行する
