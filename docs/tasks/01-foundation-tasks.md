# 01. 基盤タスク

## F-001 プロジェクト初期セットアップ

- 目的: Next.js / TypeScript / Tailwind / Vitest / Playwright の土台を作る
- 担当レイヤー: 基盤
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/package.json`
  - `/Users/kitamurareiki/develop/match/tsconfig.json`
  - `/Users/kitamurareiki/develop/match/next.config.ts`
  - `/Users/kitamurareiki/develop/match/tailwind.config.ts`
  - `/Users/kitamurareiki/develop/match/postcss.config.js`
  - `/Users/kitamurareiki/develop/match/vitest.config.ts`
  - `/Users/kitamurareiki/develop/match/playwright.config.ts`
  - `/Users/kitamurareiki/develop/match/src/app/layout.tsx`
  - `/Users/kitamurareiki/develop/match/src/app/globals.css`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export default function RootLayout(props: Readonly<{ children: React.ReactNode }>): JSX.Element`
- 実装内容:
  - App Router 構成を作る
  - `src/` 配下に統一する
  - `npm scripts` に `dev`, `build`, `lint`, `test`, `test:e2e` を定義する
  - Tailwind を有効化する
- 完了条件:
  - `npm run build` が通る
  - `npm run test` が空テストでも実行できる
- 依存関係: 依存なし
- 並列作業メモ: 他タスクの前提なので最初に着手する

## F-002 shadcn/ui 導入と共通UI土台

- 目的: UI自作を避け、参加者画面と運営画面で共通利用するコンポーネント基盤を作る
- 担当レイヤー: UI基盤
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/components.json`
  - `/Users/kitamurareiki/develop/match/src/components/ui/button.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/ui/card.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/ui/input.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/ui/dialog.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/ui/badge.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/ui/table.tsx`
  - `/Users/kitamurareiki/develop/match/src/lib/utils.ts`
- 更新ファイル:
  - `/Users/kitamurareiki/develop/match/tailwind.config.ts`
- 実装する関数シグネチャ:
  - `export function cn(...inputs: ClassValue[]): string`
- 実装内容:
  - 最低限必要な shadcn/ui コンポーネントを追加する
  - モバイル用レイアウトに使うカード・ボタン・入力・ダイアログを揃える
- 完了条件:
  - 参加者画面と運営画面で使えるUI部品が揃っている
- 依存関係: `F-001`
- 並列作業メモ: `F-003` と並列可能

## F-003 Supabase 接続基盤

- 目的: アプリ全体で共通利用する DB クライアントを定義する
- 担当レイヤー: DB基盤
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/db/client.ts`
  - `/Users/kitamurareiki/develop/match/src/lib/db/server.ts`
  - `/Users/kitamurareiki/develop/match/src/lib/db/env.ts`
  - `/Users/kitamurareiki/develop/match/.env.example`
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

## F-004 初期マイグレーション

- 目的: MVP必須テーブルを全て作成する
- 担当レイヤー: DB
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/supabase/migrations/0001_init_schema.sql`
- 更新ファイル: なし
- 実装する関数シグネチャ: なし
- 実装内容:
  - `events`, `participants`, `participant_sessions`, `tables`, `matches`, `chip_ledger`, `admin_users` を作る
  - 主キー、外部キー、unique 制約、index を設計書通りに定義する
  - `status` 系の check 制約を入れる
- 完了条件:
  - マイグレーション適用で全テーブルが作成される
- 依存関係: `F-003`
- 並列作業メモ: `F-005` とファイル衝突するので同時編集しない

## F-005 seed データ作成

- 目的: 開発とデモに必要な初期データを投入できるようにする
- 担当レイヤー: DB
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/supabase/seed.sql`
- 更新ファイル: なし
- 実装する関数シグネチャ: なし
- 実装内容:
  - `events` に active イベントを1件入れる
  - `tables` に 1-5 卓を固定投入する
  - `admin_users` に開発用ダミー運営を1件作る
- 完了条件:
  - seed 実行後にイベント・卓5件・運営1件が確認できる
- 依存関係: `F-004`
- 並列作業メモ: `F-006` と並列可能

## F-006 DB型定義

- 目的: DBスキーマを TypeScript 型として利用できるようにする
- 担当レイヤー: 型
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/db/types.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]`
  - `export interface Database { ... }`
- 実装内容:
  - Supabase 用の `Database` 型を定義する
  - 主要テーブルの Row / Insert / Update を記述する
- 完了条件:
  - service 層で `Database` 型を使える
- 依存関係: `F-004`
- 並列作業メモ: `F-005` と並列可能

## F-007 ドメイン enum / 型定義

- 目的: 参加者・卓・試合の状態を型安全に扱う
- 担当レイヤー: ドメイン
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/domain/participant-status.ts`
  - `/Users/kitamurareiki/develop/match/src/lib/domain/table-status.ts`
  - `/Users/kitamurareiki/develop/match/src/lib/domain/match-status.ts`
  - `/Users/kitamurareiki/develop/match/src/lib/domain/errors.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export const PARTICIPANT_STATUSES: readonly ParticipantStatus[]`
  - `export function isParticipantStatus(value: string): value is ParticipantStatus`
  - `export class AppError extends Error { constructor(code: string, message: string, status: number) }`
  - `export class DomainConflictError extends AppError {}`
- 実装内容:
  - 状態文字列 union を定義する
  - バリデーションに使う type guard を追加する
  - API共通で使うエラー型を定義する
- 完了条件:
  - 以後の service / validator / API がこの型に依存できる
- 依存関係: `F-001`
- 並列作業メモ: `F-004` 完了前でも先に作り始めてよい

## F-008 バリデーション定義

- 目的: API入力を zod で厳密化する
- 担当レイヤー: バリデーション
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/validators/participant.ts`
  - `/Users/kitamurareiki/develop/match/src/lib/validators/match.ts`
  - `/Users/kitamurareiki/develop/match/src/lib/validators/admin.ts`
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

## F-009 チップ計算ドメインロジック

- 目的: ベット額計算と払い出しルールを純粋関数で固定する
- 担当レイヤー: ドメイン
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/domain/chip-rules.ts`
  - `/Users/kitamurareiki/develop/match/src/tests/unit/chip-rules.test.ts`
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

## F-010 状態遷移ガード

- 目的: 許可される状態遷移だけを明示的に通す
- 担当レイヤー: ドメイン
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/domain/state-machine.ts`
  - `/Users/kitamurareiki/develop/match/src/tests/unit/state-machine.test.ts`
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

## F-011 参加者セッション基盤

- 目的: 単一セッション制御とトークン検証の共通ロジックを作る
- 担当レイヤー: 認証
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/auth/participant-session.ts`
  - `/Users/kitamurareiki/develop/match/src/tests/unit/participant-session.test.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function issueParticipantSession(params: { participantId: string }): Promise<{ sessionId: string; rawToken: string }>`
  - `export async function invalidateParticipantSessions(participantId: string): Promise<void>`
  - `export async function verifyParticipantSession(rawToken: string): Promise<{ participantId: string; sessionId: string }>`
  - `export async function touchParticipantSession(sessionId: string): Promise<void>`
- 実装内容:
  - ランダムトークン生成
  - ハッシュ保存
  - 旧セッション無効化
  - 検証と最終アクセス更新
- 完了条件:
  - 1参加者1有効セッションの制御が unit test で保証される
- 依存関係: `F-003`, `F-004`, `F-006`
- 並列作業メモ: `F-012` と並列可能

## F-012 運営セッション基盤

- 目的: 運営ログイン後のセッション管理を共通化する
- 担当レイヤー: 認証
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/auth/admin-session.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function createAdminSession(adminUserId: string): Promise<void>`
  - `export async function requireAdminSession(): Promise<{ adminUserId: string }>`
  - `export async function clearAdminSession(): Promise<void>`
- 実装内容:
  - httpOnly cookie ベースで簡易運営セッションを作る
- 完了条件:
  - 運営APIで共通利用できる
- 依存関係: `F-001`
- 並列作業メモ: `F-011` と並列可能
