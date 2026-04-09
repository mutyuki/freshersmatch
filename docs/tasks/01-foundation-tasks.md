# 01. 基盤タスク

## F-001 プロジェクト初期セットアップ

- 目的: Next.js / TypeScript / Tailwind / Vitest / Playwright の土台を作る
- 担当レイヤー: 基盤
- 新規作成ファイル:
  - `../../package.json`
  - `../../tsconfig.json`
  - `../../next.config.ts`
  - `../../postcss.config.mjs`
  - `../../vitest.config.ts`
  - `../../playwright.config.ts`
  - `../../src/app/layout.tsx`
  - `../../src/app/globals.css`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export default function RootLayout(props: Readonly<{ children: React.ReactNode }>): JSX.Element`
- 実装内容:
  - App Router 構成を作る
  - `src/` 配下に統一する
  - `npm scripts` に `dev`, `build`, `lint`, `test`, `test:e2e` を定義する
  - Tailwind を有効化する
- 完了条件:
  - `pnpm build` が通る
  - `pnpm test` が空テストでも実行できる
- 依存関係: 依存なし
- 並列作業メモ: 他タスクの前提なので最初に着手する
- 推奨 skill:
  - `freshers-match-overview`
  - `freshers-match-testing`
- 先に確認するファイル:
  - `../design/04-implementation-plan.md`
  - `00-task-strategy.md`
  - `../../.codex/skills/freshers-match-overview/SKILL.md`
- おすすめプロンプト:
  - `freshers-match-overview と freshers-match-testing を使って F-001 を実装してください。対象は package.json, tsconfig, next.config, test/config, src/app/layout.tsx, src/app/globals.css です。Next.js App Router 前提で基盤を整え、Biome を唯一の formatter/linter としてください。完了時は pnpm format, pnpm lint, pnpm typecheck, 可能なら pnpm build と pnpm test を実行してください。`

## F-002 shadcn/ui 導入と共通UI土台

- 目的: UI自作を避け、参加者画面と運営画面で共通利用するコンポーネント基盤を作る
- 担当レイヤー: UI基盤
- 新規作成ファイル:
  - `../../components.json`
  - `../../src/components/ui/button.tsx`
  - `../../src/components/ui/card.tsx`
  - `../../src/components/ui/input.tsx`
  - `../../src/components/ui/dialog.tsx`
  - `../../src/components/ui/badge.tsx`
  - `../../src/components/ui/table.tsx`
  - `../../src/lib/utils.ts`
- 更新ファイル:
  - `../../src/app/globals.css`
- 実装する関数シグネチャ:
  - `export function cn(...inputs: ClassValue[]): string`
- 実装内容:
  - 最低限必要な shadcn/ui コンポーネントを追加する
  - モバイル用レイアウトに使うカード・ボタン・入力・ダイアログを揃える
- 完了条件:
  - 参加者画面と運営画面で使えるUI部品が揃っている
- 依存関係: `F-001`
- 並列作業メモ: `F-003` と並列可能
- 推奨 skill:
  - `freshers-match-overview`
  - `freshers-match-participant-ui`
  - `freshers-match-admin-ui`
- 先に確認するファイル:
  - `../../layout.pen`
  - `../design/04-implementation-plan.md`
  - `../../.codex/skills/freshers-match-participant-ui/SKILL.md`
  - `../../.codex/skills/freshers-match-admin-ui/SKILL.md`
- おすすめプロンプト:
  - `freshers-match-participant-ui と freshers-match-admin-ui を使って F-002 を実装してください。shadcn/ui の共通土台を整え、参加者スマホUIと admin PC UI の両方で使う button, card, input, dialog, badge, table と cn ユーティリティを確認・整備してください。layout.pen は参考にしつつ、実装時にさらにブラッシュアップできる構成にしてください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-003 Supabase 接続基盤

- 目的: アプリ全体で共通利用する DB クライアントを定義する
- 担当レイヤー: DB基盤
- 新規作成ファイル:
  - `../../src/lib/db/client.ts`
  - `../../src/lib/db/server.ts`
  - `../../src/lib/db/env.ts`
  - `../../.env.example`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export function getSupabaseBrowserClient(): SupabaseClient<Database>`
  - `export function getSupabaseServerClient(): SupabaseClient<Database>`
  - `export function getRequiredEnv(name: string): string`
- 実装内容:
  - 環境変数を安全に読む
  - ブラウザ用とサーバー用のクライアントを分ける
- 完了条件:
  - サーバーから Supabase クライアントが import できる
- 依存関係: `F-001`
- 並列作業メモ: `F-002` と並列可能
- 推奨 skill:
  - `freshers-match-overview`
  - `freshers-match-db-api`
- 先に確認するファイル:
  - `../setup/supabase-bootstrap.md`
  - `../design/02-data-model-and-api.md`
  - `../../.codex/skills/freshers-match-db-api/SKILL.md`
- おすすめプロンプト:
  - `freshers-match-db-api を使って F-003 を実装してください。src/lib/db/client.ts, src/lib/db/server.ts, src/lib/db/env.ts, .env.example を対象に、browser/server/service-role 用の Supabase 接続基盤を整理してください。画面や component から直接 DB を触らない前提を守ってください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-004 初期マイグレーション

- 目的: MVP必須テーブルを全て作成する
- 担当レイヤー: DB
- 新規作成ファイル:
  - `../../supabase/migrations/0001_init_schema.sql`
- 更新ファイル: なし
- 実装する関数シグネチャ: なし
- 実装内容:
  - `events`, `participants`, `participant_sessions`, `tables`, `matches`, `chip_ledger`, `admin_users` を作る
  - 主キー、外部キー、unique 制約、index を設計書通りに定義する
  - `status` 系の check 制約を入れる
  - `events.initial_chip_balance` を持たせる
  - `participants` に `is_paused`, `is_disqualified` を持たせず、`status` を真実源にする
  - 通常戦 / 運営戦の整合制約を `matches` に入れる
  - `participant_sessions` に `partial unique index (participant_id) where is_active = true` を入れる
  - `matches_started_and_bet_consistency_check` を含む guardrail も `0001` に入れる
- 完了条件:
  - マイグレーション適用で全テーブルが作成される
- 依存関係: `F-003`
- 並列作業メモ: `F-005` とファイル衝突するので同時編集しない
- 推奨 skill:
  - `freshers-match-db-api`
  - `freshers-match-match-flow`
- 先に確認するファイル:
  - `../design/01-state-and-realtime.md`
  - `../design/02-data-model-and-api.md`
  - `../../supabase/migrations/0001_init_schema.sql`
  - `../../.codex/skills/freshers-match-match-flow/references/state-machine.md`
- おすすめプロンプト:
  - `freshers-match-db-api と freshers-match-match-flow を使って F-004 を実装してください。supabase/migrations/0001_init_schema.sql を対象に、events, participants, participant_sessions, tables, matches, chip_ledger, admin_users を設計書どおり作成してください。status 系 check 制約、外部キー、index、RLS の方針も反映し、再実行で落ちにくい migration にしてください。完了時は SQL の整合性を見直し、pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-005 seed データ作成

- 目的: 開発とデモに必要な初期データを投入できるようにする
- 担当レイヤー: DB
- 新規作成ファイル:
  - `../../supabase/seed.sql`
- 更新ファイル: なし
- 実装する関数シグネチャ: なし
- 実装内容:
  - `events` に active イベントを1件入れる
  - 初期チップ配布量を event 設定に入れる
  - `tables` に 1-5 卓を固定投入する
  - `admin_users` に開発用ダミー運営を1件作る
- 完了条件:
  - seed 実行後にイベント・卓5件・運営1件が確認できる
- 依存関係: `F-004`
- 並列作業メモ: `F-006` と並列可能
- 推奨 skill:
  - `freshers-match-db-api`
- 先に確認するファイル:
  - `../setup/supabase-bootstrap.md`
  - `../../supabase/seed.sql`
  - `../design/00-requirements-and-mvp.md`
- おすすめプロンプト:
  - `freshers-match-db-api を使って F-005 を実装してください。supabase/seed.sql に active event 1件、tables 1-5、admin_users 1件を投入する seed を整備してください。会場コード、固定卓、運営ログイン前提が設計と一致するようにしてください。完了時は seed の説明コメントや関連手順書との整合も確認してください。`

## F-006 DB型定義

- 目的: DBスキーマを TypeScript 型として利用できるようにする
- 担当レイヤー: 型
- 新規作成ファイル:
  - `../../src/lib/db/types.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]`
  - `export interface Database { ... }`
- 実装内容:
  - Supabase 用の `Database` 型を定義する
  - 主要テーブルの Row / Insert / Update を記述する
  - `events.initial_chip_balance` を型へ反映する
  - `participants` から `is_paused`, `is_disqualified` を除き、`status` と `disqualified_reason` に寄せる
  - `matches.dispute_count`, `matches.last_disputed_at` を型へ反映する
- 完了条件:
  - service 層で `Database` 型を使える
- 依存関係: `F-004`
- 並列作業メモ: `F-005` と並列可能
- 推奨 skill:
  - `freshers-match-db-api`
- 先に確認するファイル:
  - `../../supabase/migrations/0001_init_schema.sql`
  - `../design/02-data-model-and-api.md`
  - `../../src/lib/db/types.ts`
- おすすめプロンプト:
  - `freshers-match-db-api を使って F-006 を実装してください。migration と設計書に合わせて src/lib/db/types.ts の Database 型を整備し、Row / Insert / Update を漏れなく定義してください。サービス層が型安全に書けることを優先し、実際の DB 列名とズレないようにしてください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-007 ドメイン enum / 型定義

- 目的: 参加者・卓・試合の状態を型安全に扱う
- 担当レイヤー: ドメイン
- 新規作成ファイル:
  - `../../src/lib/domain/participant-status.ts`
  - `../../src/lib/domain/table-status.ts`
  - `../../src/lib/domain/match-status.ts`
  - `../../src/lib/domain/errors.ts`
  - `../../src/lib/contracts/participant-runtime.ts`
  - `../../src/lib/contracts/ranking.ts`
  - `../../src/lib/contracts/admin-dashboard.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export const PARTICIPANT_STATUSES: readonly ParticipantStatus[]`
  - `export function isParticipantStatus(value: string): value is ParticipantStatus`
  - `export class AppError extends Error { constructor(code: string, message: string, status: number) }`
  - `export class DomainConflictError extends AppError {}`
  - `export interface ParticipantRuntimeState { ... }`
  - `export interface RankingEntry { ... }`
  - `export interface AdminDashboardData { ... }`
- 実装内容:
  - 状態文字列 union を定義する
  - バリデーションに使う type guard を追加する
  - API共通で使うエラー型を定義する
  - participant / ranking / admin dashboard の共有レスポンス契約を固定する
  - `ParticipantRuntimeState` には `queuedAt` も含める
  - `ParticipantRuntimeState` には `lastNonDisconnectStatus`, `opponentReady`, `winnerParticipantId`, `winnerClaimedByParticipantId`, `disqualifiedReason`, `resultDelta` まで含める
  - `AdminDashboardData` には `occupantNicknames`, `startedAt` まで含める
  - `RankingEntry` には `isCurrentParticipant` を持たせず、ハイライトは client 側で判定する
- 完了条件:
  - 以後の service / validator / API / UI が同じ契約型に依存できる
- 依存関係: `F-001`, `F-006`
- 並列作業メモ: `F-004` 完了前でも先に作り始めてよい
- 推奨 skill:
  - `freshers-match-overview`
  - `freshers-match-match-flow`
- 先に確認するファイル:
  - `../design/01-state-and-realtime.md`
  - `../design/02-data-model-and-api.md`
  - `../design/05-implementation-guardrails.md`
  - `../design/06-rpc-spec.md`
  - `../../.codex/skills/freshers-match-match-flow/references/state-machine.md`
  - `00-task-strategy.md`
- おすすめプロンプト:
  - `freshers-match-match-flow を使って F-007 を実装してください。participant, table, match の状態定義と AppError / DomainConflictError を src/lib/domain 配下に追加し、さらに ParticipantRuntimeState, RankingEntry, AdminDashboardData を src/lib/contracts 配下に定義してください。以後の validator, service, API, UI が同じ契約型を共通利用できる形にし、状態名やレスポンス項目は設計書からずらさないでください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-008 バリデーション定義

- 目的: API入力を zod で厳密化する
- 担当レイヤー: バリデーション
- 新規作成ファイル:
  - `../../src/lib/validators/participant.ts`
  - `../../src/lib/validators/match.ts`
  - `../../src/lib/validators/admin.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export const registerParticipantSchema: z.ZodObject<...>`
  - `export const readyMatchSchema: z.ZodObject<...>`
  - `export const adminLoginSchema: z.ZodObject<...>`
- 実装内容:
  - 各 API 用の request body schema を定義する
- 完了条件:
  - 参加者、試合、運営の主要 API 入力 schema が揃う
- 依存関係: `F-007`
- 並列作業メモ: `F-009`, `F-010` と並列可能
- 推奨 skill:
  - `freshers-match-db-api`
  - `freshers-match-match-flow`
- 先に確認するファイル:
  - `../design/02-data-model-and-api.md`
  - `../../src/lib/domain/participant-status.ts`
  - `../../src/lib/domain/match-status.ts`
- おすすめプロンプト:
  - `freshers-match-db-api と freshers-match-match-flow を使って F-008 を実装してください。participant, match, admin の各 request body を zod で厳密化し、API から直接使える schema と型を src/lib/validators に作成してください。曖昧な optional を増やさず、MVPに必要な入力だけを定義してください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-009 チップ計算ドメインロジック

- 目的: ベット額計算と払い出しルールを純粋関数で固定する
- 担当レイヤー: ドメイン
- 新規作成ファイル:
  - `../../src/lib/domain/chip-rules.ts`
  - `../../src/tests/unit/chip-rules.test.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export function calculateHeadToHeadBet(params: { player1Balance: number; player2Balance: number; fixedBetAmount: number }): number`
  - `export function calculateStaffMatchBet(params: { playerBalance: number; fixedBetAmount: number }): number`
  - `export function calculateHeadToHeadPayout(params: { actualBetAmount: number }): { winnerDelta: number; loserDelta: number }`
  - `export function calculateStaffMatchPayout(params: { actualBetAmount: number; playerWon: boolean }): number`
- 実装内容:
  - オールインと運営戦のルールを固定する
  - テストで境界値を網羅する
- 完了条件:
  - 所持チップ不足、同額、0チップ、運営戦のケースがテストされる
- 依存関係: `F-007`
- 並列作業メモ: `F-010` と並列可能
- 推奨 skill:
  - `freshers-match-match-flow`
  - `freshers-match-testing`
- 先に確認するファイル:
  - `../design/00-requirements-and-mvp.md`
  - `../../.codex/skills/freshers-match-testing/references/regression-priority.md`
  - `../testing/test-matrix.md`
- おすすめプロンプト:
  - `freshers-match-match-flow と freshers-match-testing を使って F-009 を TDD で実装してください。chip-rules の純粋関数を先にテストから起こし、固定ベット、オールイン、サイドポットなし、運営戦の払い出しを仕様どおり固定してください。勝手にルールを足さず、境界値を中心にテストしてください。完了時は pnpm format, pnpm lint, pnpm typecheck, pnpm test を実行してください。`

## F-010 状態遷移ガード

- 目的: 許可される状態遷移だけを明示的に通す
- 担当レイヤー: ドメイン
- 新規作成ファイル:
  - `../../src/lib/domain/state-machine.ts`
  - `../../src/tests/unit/state-machine.test.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export function assertParticipantTransition(current: ParticipantStatus, next: ParticipantStatus): void`
  - `export function assertTableTransition(current: TableStatus, next: TableStatus): void`
  - `export function assertMatchTransition(current: MatchStatus, next: MatchStatus): void`
- 実装内容:
  - 設計書通りの遷移のみ許可する
  - 不正遷移は `DomainConflictError` を投げる
- 完了条件:
  - 許可・不許可両方のケースがテストで固定される
- 依存関係: `F-007`
- 並列作業メモ: `F-009` と並列可能
- 推奨 skill:
  - `freshers-match-match-flow`
  - `freshers-match-testing`
- 先に確認するファイル:
  - `../design/01-state-and-realtime.md`
  - `../../.codex/skills/freshers-match-match-flow/references/state-machine.md`
  - `../testing/test-matrix.md`
- おすすめプロンプト:
  - `freshers-match-match-flow と freshers-match-testing を使って F-010 を TDD で実装してください。participant, table, match の状態遷移ガードを state-machine.ts に定義し、許可される遷移だけを通してください。不正遷移は DomainConflictError に統一してください。完了時は pnpm format, pnpm lint, pnpm typecheck, pnpm test を実行してください。`

## F-011 参加者セッション基盤

- 目的: 単一セッション制御とトークン検証の共通ロジックを作る
- 担当レイヤー: 認証
- 新規作成ファイル:
  - `../../src/lib/auth/participant-session.ts`
  - `../../src/tests/unit/participant-session.test.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export function generateParticipantSessionToken(): string`
  - `export async function hashParticipantSessionToken(rawToken: string): Promise<string>`
  - `export async function verifyParticipantSession(rawToken: string): Promise<{ participantId: string; sessionId: string }>`
  - `export async function touchParticipantSession(sessionId: string): Promise<void>`
- 実装内容:
  - ランダムトークン生成
  - ハッシュ生成
  - 検証と最終アクセス更新
  - `participant_sessions` の read / verify helper を提供する
  - 新規 session row の発行と旧セッション無効化は RPC 側の責務として持たせ、auth helper 側で二重実装しない
  - `POST /api/participant/session/restore` と `GET /api/participant/me` の両方から使えるようにする
- 完了条件:
  - token 生成 / hash / verify / touch の責務が unit test で保証される
  - session 発行責務が RPC と衝突しない
- 依存関係: `F-003`, `F-004`, `F-006`
- 並列作業メモ: `F-012` と並列可能
- 推奨 skill:
  - `freshers-match-db-api`
  - `freshers-match-testing`
- 先に確認するファイル:
  - `../design/00-requirements-and-mvp.md`
  - `../design/02-data-model-and-api.md`
  - `../design/06-rpc-spec.md`
  - `../../src/lib/db/server.ts`
  - `../../supabase/migrations/0001_init_schema.sql`
- おすすめプロンプト:
  - `freshers-match-db-api と freshers-match-testing を使って F-011 を TDD で実装してください。participant-session.ts にトークン生成、hash 化、verify、last_seen touch を実装してください。新規 session row の発行と旧セッション無効化は register_participant_and_issue_session RPC 側の責務なので、auth helper で二重実装しないでください。participant_sessions の partial unique index 前提で verify 系を型安全に整えてください。完了時は pnpm format, pnpm lint, pnpm typecheck, pnpm test を実行してください。`

## F-012 運営セッション基盤

- 目的: 運営ログイン後のセッション管理を共通化する
- 担当レイヤー: 認証
- 新規作成ファイル:
  - `../../src/lib/auth/admin-session.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function createAdminSession(adminUserId: string): Promise<void>`
  - `export async function requireAdminSession(): Promise<{ adminUserId: string }>`
  - `export async function clearAdminSession(): Promise<void>`
- 実装内容:
  - httpOnly cookie ベースで運営セッションを作る
  - 署名・有効期限・secure 属性を備え、参加者セッションと完全に分離する
- 完了条件:
  - 運営APIで共通利用できる
- 依存関係: `F-001`
- 並列作業メモ: `F-011` と並列可能
- 推奨 skill:
  - `freshers-match-db-api`
  - `freshers-match-admin-ui`
- 先に確認するファイル:
  - `../design/03-admin-ops-and-failures.md`
  - `../../src/app/layout.tsx`
  - `../../.codex/skills/freshers-match-admin-ui/references/operator-actions.md`
- おすすめプロンプト:
  - `freshers-match-db-api と freshers-match-admin-ui を使って F-012 を実装してください。admin-session.ts に httpOnly cookie ベースの運営セッションを作成し、署名・有効期限・secure 属性を備えた require / create / clear 関数を定義してください。参加者セッションと責務を混ぜないでください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-013a 参加者系 RPC 実装

- 目的: 参加者登録・キュー操作・結果確認の RPC を実装する
- 担当レイヤー: DB / transaction
- 新規作成ファイル:
  - `../../supabase/migrations/0003_add_participant_rpcs.sql`
- 実装内容:
  - `register_participant_and_issue_session`
  - `start_queue_and_try_match`
  - `cancel_queue`
  - `acknowledge_result_confirmed`
  - 各 RPC で `events -> participants -> matches -> tables` のロック順を守る
- 完了条件:
  - 上記4関数が migration として存在する
- 依存関係: `F-004`, `F-009`, `F-010`
- 並列作業メモ: `F-013b`, `F-013c` と同時に進めない（同一 migration ファイルを避けるため）
- 推奨 skill:
  - `freshers-match-db-api`
  - `freshers-match-match-flow`
- 先に確認するファイル:
  - `../design/02-data-model-and-api.md`
  - `../design/06-rpc-spec.md`
  - `../../supabase/migrations/0001_init_schema.sql`
- おすすめプロンプト:
  - `freshers-match-db-api と freshers-match-match-flow を使って F-013a を実装してください。0003_add_participant_rpcs.sql に register_participant_and_issue_session, start_queue_and_try_match, cancel_queue, acknowledge_result_confirmed を PostgreSQL 関数として実装してください。ロック順と idempotent 要件を 06-rpc-spec.md に合わせて守ってください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-013b 試合系 RPC 実装

- 目的: 試合操作の RPC を実装する
- 担当レイヤー: DB / transaction
- 新規作成ファイル:
  - `../../supabase/migrations/0004_add_match_rpcs.sql`
- 実装内容:
  - `ready_match`
  - `cancel_match_before_start`
  - `claim_match_win`
  - `approve_match_result`
  - `ready_match` で `started_at` を設定する
  - idempotent 要件を SQL 側で満たす
- 完了条件:
  - 上記4関数が migration として存在する
- 依存関係: `F-013a`
- 並列作業メモ: `F-013a` 完了後に着手
- 推奨 skill:
  - `freshers-match-db-api`
  - `freshers-match-match-flow`
  - `freshers-match-testing`
- 先に確認するファイル:
  - `../design/06-rpc-spec.md`
  - `../../supabase/migrations/0003_add_participant_rpcs.sql`
- おすすめプロンプト:
  - `freshers-match-db-api と freshers-match-match-flow を使って F-013b を実装してください。0004_add_match_rpcs.sql に ready_match, cancel_match_before_start, claim_match_win, approve_match_result を実装してください。ready_match での started_at 設定と idempotent 要件を守ってください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-013c 運営系 RPC 実装 (参加者管理)

- 目的: 運営の参加者管理用 RPC を実装する
- 担当レイヤー: DB / transaction
- 新規作成ファイル:
  - `../../supabase/migrations/0005_add_admin_participant_rpcs.sql`
- 実装内容:
  - `adjust_participant_chip`
  - `pause_participant`
  - `unpause_participant`
  - idempotent 要件を SQL 側で満たす
- 完了条件:
  - 上記3関数が migration として存在する
- 依存関係: `F-013a`
- 並列作業メモ: `F-013b` と並列可能
- 推奨 skill:
  - `freshers-match-db-api`
  - `freshers-match-testing`
- 先に確認するファイル:
  - `../design/06-rpc-spec.md`
- おすすめプロンプト:
  - `freshers-match-db-api と freshers-match-testing を使って F-013c を実装してください。0005_add_admin_participant_rpcs.sql に adjust_participant_chip, pause_participant, unpause_participant を実装してください。idempotent 要件を守り、06-rpc-spec.md の副作用定義を満たしてください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-013d 運営系 RPC 実装 (卓管理・失格)

- 目的: 運営の卓強制解放と失格処理用 RPC を実装する
- 担当レイヤー: DB / transaction
- 新規作成ファイル:
  - `../../supabase/migrations/0006_add_admin_table_rpcs.sql`
- 実装内容:
  - `disqualify_participant`
  - `force_release_table`
  - `hold_table_by_admin`
  - `release_table_admin_hold`
  - idempotent 要件を SQL 側で満たす
- 完了条件:
  - 上記4関数が migration として存在する
- 依存関係: `F-013a`
- 並列作業メモ: `F-013c` と並列可能
- 推奨 skill:
  - `freshers-match-db-api`
  - `freshers-match-match-flow`
- 先に確認するファイル:
  - `../design/06-rpc-spec.md`
  - `../design/03-admin-ops-and-failures.md`
- おすすめプロンプト:
  - `freshers-match-db-api と freshers-match-match-flow を使って F-013d を実装してください。0006_add_admin_table_rpcs.sql に disqualify_participant, force_release_table, hold_table_by_admin, release_table_admin_hold を実装してください。disqualify 時の 2 モードの挙動と、force_release_table での関連データ解放を 06-rpc-spec.md に合わせてください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-013e 運営系 RPC 実装 (試合管理)

- 目的: 運営の試合結果手動確定と運営戦用 RPC を実装する
- 担当レイヤー: DB / transaction
- 新規作成ファイル:
  - `../../supabase/migrations/0007_add_admin_match_rpcs.sql`
- 実装内容:
  - `start_staff_match`
  - `resolve_staff_match`
  - `resolve_match_by_admin`
  - idempotent 要件を SQL 側で満たす
- 完了条件:
  - 上記3関数が migration として存在する
- 依存関係: `F-013a`
- 並列作業メモ: `F-013c`, `F-013d` と並列可能
- 推奨 skill:
  - `freshers-match-db-api`
  - `freshers-match-match-flow`
- 先に確認するファイル:
  - `../design/06-rpc-spec.md`
- おすすめプロンプト:
  - `freshers-match-db-api と freshers-match-match-flow を使って F-013e を実装してください。0007_add_admin_match_rpcs.sql に start_staff_match, resolve_staff_match, resolve_match_by_admin を実装してください。運営戦作成と各種勝敗確定処理を 06-rpc-spec.md に合わせてください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-014 Supabase RPC 型同期

- 目的: RPC 呼び出しを service 層で型安全に扱えるようにする
- 担当レイヤー: 型
- 新規作成ファイル: なし
- 更新ファイル:
  - `../../src/lib/db/types.ts`
- 実装する関数シグネチャ:
  - `export interface Database { public: { Functions: { ... } } }`
- 実装内容:
  - 全18 RPC の `Args` と `Returns` を `Database["public"]["Functions"]` へ定義する
  - 対象: `register_participant_and_issue_session`, `start_queue_and_try_match`, `cancel_queue`, `ready_match`, `cancel_match_before_start`, `claim_match_win`, `approve_match_result`, `adjust_participant_chip`, `resolve_match_by_admin`, `start_staff_match`, `resolve_staff_match`, `acknowledge_result_confirmed`, `pause_participant`, `unpause_participant`, `disqualify_participant`, `force_release_table`, `hold_table_by_admin`, `release_table_admin_hold`
- 完了条件:
  - service 層から Supabase RPC を型安全に呼べる
  - `Functions: Record<string, never>` のまま残らない
- 依存関係: `F-013a`, `F-013b`, `F-013c`, `F-013d`, `F-013e`
- 並列作業メモ: service 実装へ入る直前に終えておく
- 推奨 skill:
  - `freshers-match-db-api`
- 先に確認するファイル:
  - `../design/06-rpc-spec.md`
  - `../../src/lib/db/types.ts`
  - `../../supabase/migrations/0003_add_participant_rpcs.sql`
  - `../../supabase/migrations/0004_add_match_rpcs.sql`
  - `../../supabase/migrations/0005_add_admin_participant_rpcs.sql`
  - `../../supabase/migrations/0006_add_admin_table_rpcs.sql`
  - `../../supabase/migrations/0007_add_admin_match_rpcs.sql`
- おすすめプロンプト:
  - `freshers-match-db-api を使って F-014 を実装してください。docs/design/06-rpc-spec.md と migration ファイルに合わせて、src/lib/db/types.ts の Database.public.Functions を全18 RPC の Args / Returns で埋めてください。service 層から型安全に rpc() を呼べることを最優先にしてください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-015 ルートページルーティング

- 目的: `/` にアクセスした参加者を適切なページへ振り分ける
- 担当レイヤー: UI
- 新規作成ファイル: なし
- 更新ファイル:
  - `../../src/app/page.tsx`
- 実装する関数シグネチャ:
  - `export default function RootPage(): JSX.Element`
- 実装内容:
  - `'use client'` のクライアントコンポーネントとして実装する
  - localStorage にセッショントークンがなければ `/join` へリダイレクト
  - トークンがあれば `/api/participant/session/restore` を呼び、`status` に応じて `/home` または `/match` へリダイレクト
  - 復元失敗時はトークンをクリアして `/join` へリダイレクト
  - 復元API呼び出し中はローディングスピナーを全画面で表示し、白画面やちらつきを出さない
  - リダイレクト完了まで他の要素は描画しない（スプラッシュスクリーン方式）
- 完了条件:
  - 未登録者は `/join` へ遷移する
  - 登録済み参加者は適切な画面へ復帰する
- 依存関係: `P-002`, `P-005`
- 並列作業メモ: `P-004` と並列可能
- 推奨 skill:
  - `freshers-match-participant-ui`
- 先に確認するファイル:
  - `../design/02-data-model-and-api.md`
  - `../../src/lib/session/participant-client-session.ts`
- おすすめプロンプト:
  - `freshers-match-participant-ui を使って F-015 を実装してください。src/app/page.tsx でセッショントークンの有無を確認し、なければ /join、あれば復元APIで status を取得して /home または /match へリダイレクトしてください。復元失敗時はトークンクリアして /join へ。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## F-016 admin 共通レイアウト

- 目的: 運営画面の共通ヘッダー・ナビゲーション・レイアウトを作る
- 担当レイヤー: UI
- 新規作成ファイル:
  - `../../src/app/admin/layout.tsx`
  - `../../src/components/admin/admin-shell.tsx`
  - `../../src/components/admin/admin-nav.tsx`
- 実装する関数シグネチャ:
  - `export default function AdminLayout(props: Readonly<{ children: React.ReactNode }>): JSX.Element`
  - `export function AdminShell(props: { title: string; children: React.ReactNode }): JSX.Element`
  - `export function AdminNav(): JSX.Element`
- 実装内容:
  - デスクトップ前提で `max-w-7xl` 相当の横幅レイアウトを組む
  - ダッシュボード / 参加者 / 試合 / 卓 ページへのナビゲーションを置く
  - admin session がなければ `/admin/login` へリダイレクト
  - [layout.pen](../../layout.pen) の admin 画面を参考にする
- 完了条件:
  - admin 各ページが同じ UI 骨組みで実装できる
- 依存関係: `F-002`, `F-012`
- 並列作業メモ: `A-001` と並列可能
- 推奨 skill:
  - `freshers-match-admin-ui`
- 先に確認するファイル:
  - `../../layout.pen`
  - `../design/04-implementation-plan.md`
  - `../../src/lib/auth/admin-session.ts`
- おすすめプロンプト:
  - `freshers-match-admin-ui を使って F-016 を実装してください。admin/layout.tsx, AdminShell, AdminNav を作り、max-w-7xl のデスクトップ前提レイアウトでダッシュボード・参加者・試合・卓ページへのナビゲーションを整備してください。admin session がなければ /admin/login へリダイレクトしてください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

