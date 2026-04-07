# 04. 運営・品質タスク

## A-001 運営ログイン API と画面

- 目的: 運営専用 URL からパスコードでログインできるようにする
- 担当レイヤー: API / UI
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/admin/login/page.tsx`
  - `/Users/kitamurareiki/develop/match/src/app/api/admin/login/route.ts`
  - `/Users/kitamurareiki/develop/match/src/components/admin/admin-login-form.tsx`
  - `/Users/kitamurareiki/develop/match/src/lib/services/admin-auth-service.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function loginAdminWithPasscode(params: { passcode: string }): Promise<{ adminUserId: string }>`
  - `export default function AdminLoginPage(): JSX.Element`
- 実装内容:
  - `admin_users.passcode_hash` と照合
  - 成功時に admin session を発行
  - PCブラウザ前提の中央寄せログイン画面にする
  - [layout.pen](/Users/kitamurareiki/develop/match/layout.pen) の `Admin / Login` を参考にする
- 完了条件:
  - ログイン成功で `/admin/dashboard` に遷移できる
- 依存関係: `F-012`, `F-008`, `F-006`
- 並列作業メモ: `A-002` と並列可能

## A-002 運営ダッシュボード

- 目的: 卓、待機者、対戦中、切断者をまとめて見られる画面を作る
- 担当レイヤー: service / UI
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/admin/dashboard/page.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/admin/dashboard-summary.tsx`
  - `/Users/kitamurareiki/develop/match/src/lib/services/admin-dashboard-service.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function getAdminDashboardData(eventId: string): Promise<AdminDashboardData>`
  - `export default async function AdminDashboardPage(): Promise<JSX.Element>`
- 実装内容:
  - 卓一覧
  - queueing 一覧
  - in_progress 一覧
  - disconnected 一覧
  - デスクトップ前提で複数カラム表示にする
  - [layout.pen](/Users/kitamurareiki/develop/match/layout.pen) の `Admin / Dashboard` を参考にする
- 完了条件:
  - 運営が会場状況を一画面で把握できる
- 依存関係: `A-001`, `M-008`, `F-006`
- 並列作業メモ: `A-003`, `A-004`, `A-005` と並列可能

## A-003 運営 participant 操作

- 目的: チップ修正、一時停止、失格 API と UI を実装する
- 担当レイヤー: service / API / UI
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/admin/participants/page.tsx`
  - `/Users/kitamurareiki/develop/match/src/app/api/admin/participant/chip-adjust/route.ts`
  - `/Users/kitamurareiki/develop/match/src/app/api/admin/participant/pause/route.ts`
  - `/Users/kitamurareiki/develop/match/src/app/api/admin/participant/disqualify/route.ts`
  - `/Users/kitamurareiki/develop/match/src/components/admin/participant-table.tsx`
  - `/Users/kitamurareiki/develop/match/src/lib/services/admin-participant-service.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function adjustParticipantChip(params: { adminUserId: string; participantId: string; delta: number; reason: string }): Promise<void>`
  - `export async function pauseParticipant(params: { adminUserId: string; participantId: string }): Promise<void>`
  - `export async function disqualifyParticipant(params: { adminUserId: string; participantId: string; mode: "void_current_match" | "lose_current_match" }): Promise<void>`
- 実装内容:
  - chip ledger 追記
  - paused / disqualified 反映
  - 対戦中失格時の分岐処理
  - [layout.pen](/Users/kitamurareiki/develop/match/layout.pen) の `Admin / Participants` を参考にする
- 完了条件:
  - 参加者に対して必要な3操作が実行できる
- 依存関係: `A-001`, `M-004`, `F-006`
- 並列作業メモ: `A-004`, `A-005` と並列可能

## A-004 運営 match / table 操作

- 目的: 卓強制解放、試合無効、勝敗修正を実装する
- 担当レイヤー: service / API / UI
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/admin/matches/page.tsx`
  - `/Users/kitamurareiki/develop/match/src/app/admin/tables/page.tsx`
  - `/Users/kitamurareiki/develop/match/src/app/api/admin/table/force-release/route.ts`
  - `/Users/kitamurareiki/develop/match/src/app/api/admin/match/resolve/route.ts`
  - `/Users/kitamurareiki/develop/match/src/components/admin/match-table.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/admin/table-grid.tsx`
  - `/Users/kitamurareiki/develop/match/src/lib/services/admin-match-service.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function forceReleaseTable(params: { adminUserId: string; tableId: string }): Promise<void>`
  - `export async function resolveMatchByAdmin(params: { adminUserId: string; matchId: string; resolution: { type: "void" } | { type: "winner"; winnerParticipantId: string } }): Promise<void>`
- 実装内容:
  - 卓解放
  - 試合無効
  - 運営による勝敗確定
  - 参加者状態復旧
  - [layout.pen](/Users/kitamurareiki/develop/match/layout.pen) の `Admin / Matches` と `Admin / Tables` を参考にする
- 完了条件:
  - 試合トラブルを運営が手動復旧できる
- 依存関係: `A-001`, `M-004`, `F-006`
- 並列作業メモ: `A-003`, `A-005` と並列可能

## A-005 運営戦手動開始

- 目的: 待機者に対して運営戦を手動で開始できるようにする
- 担当レイヤー: service / API / UI
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/api/admin/staff-match/start/route.ts`
  - `/Users/kitamurareiki/develop/match/src/components/admin/staff-match-form.tsx`
  - `/Users/kitamurareiki/develop/match/src/lib/services/staff-match-service.ts`
- 更新ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/admin/dashboard/page.tsx`
- 実装する関数シグネチャ:
  - `export async function startStaffMatch(params: { adminUserId: string; participantId: string; optionalTableId?: string }): Promise<string>`
- 実装内容:
  - 待機中 participant と空き卓を使って `is_staff_match=true` の match を作る
  - 実装導線は [layout.pen](/Users/kitamurareiki/develop/match/layout.pen) の `Admin / Dashboard` 上の操作導線を参考にする
- 完了条件:
  - 運営が任意の待機者を運営戦へ進められる
- 依存関係: `A-001`, `M-001`, `F-006`
- 並列作業メモ: `A-003`, `A-004` と並列可能

## A-006 例外系統合テスト

- 目的: 状態競合や異常系を回帰テストで固定する
- 担当レイヤー: integration test
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/tests/integration/participant-flow.test.ts`
  - `/Users/kitamurareiki/develop/match/src/tests/integration/matching-flow.test.ts`
  - `/Users/kitamurareiki/develop/match/src/tests/integration/admin-ops.test.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `describe("participant flow", () => { ... })`
  - `describe("matching flow", () => { ... })`
  - `describe("admin ops", () => { ... })`
- 実装内容:
  - ニックネーム重複
  - 開始前キャンセル
  - 承認拒否
  - 運営修正
  - 失格中参加者
  - 旧セッション無効化後の旧トークン拒否
  - 運営戦成立と結果確定
  - `ready` / `cancel-before-start` 競合
  - 二重承認防止
  - 対戦中失格の2モード
  - 卓不足時に match 未作成
- 完了条件:
  - 主要例外ケースがテストで固定される
  - 各ケースで participant, match, table, ledger の整合性を明示 assertion している
- 依存関係: `P-002`, `M-005`, `A-003`, `A-004`
- 並列作業メモ: UIタスクとは独立して進めやすい

## A-007 E2E 最小導線

- 目的: MVP必須フローをブラウザ操作で担保する
- 担当レイヤー: E2E test
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/tests/e2e/join-and-match.spec.ts`
  - `/Users/kitamurareiki/develop/match/src/tests/e2e/admin-resolve.spec.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `test("two participants can finish a match", async ({ browser }) => { ... })`
  - `test("admin can resolve a stuck match", async ({ page }) => { ... })`
- 実装内容:
  - 参加者2人の登録から対戦完走
  - 運営がトラブル試合を解決
  - 再接続後に同じ進行状態へ戻る
  - 承認拒否後に対戦継続できる
- 完了条件:
  - 当日運用の最短導線が自動確認できる
- 依存関係: `P-004`, `P-006`, `M-006`, `A-002`, `A-004`
- 並列作業メモ: 終盤に着手する

## A-008 運営向け運用メモ

- 目的: 当日運営の復旧手順を短く明文化する
- 担当レイヤー: ドキュメント
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/docs/operations/event-day-runbook.md`
- 更新ファイル: なし
- 実装する関数シグネチャ: なし
- 実装内容:
  - よくある詰まり方
  - どの画面で何を押すか
  - 接続切れ、承認拒否、卓解放、失格の対処
- 完了条件:
  - 運営メンバーが5分で読める手順書になっている
- 依存関係: `A-002`, `A-003`, `A-004`, `A-005`
- 並列作業メモ: 実装終盤に着手する

## A-009 並列実装のおすすめ順

このセクションはタスクではなく、並列作業のまとまりを示す。

### レーン1

- `F-001` → `F-003` → `F-004` → `F-006`

### レーン2

- `F-002` → `P-003` → `P-004`

### レーン3

- `F-007` → `F-008` → `F-009` と `F-010`

### レーン4

- `F-011` → `P-001` → `P-002` → `P-005`

### レーン5

- `M-001` → `M-002` → `M-003`

### レーン6

- `M-004` → `M-005` → `M-006`

### レーン7

- `A-001` → `A-002` → `A-003` / `A-004` / `A-005`

### レーン8

- `A-006` → `A-007` → `A-008`

## A-010 テストマトリクス文書

- 目的: どの要件をどの層のテストで担保するかを明文化し、テスト漏れを防ぐ
- 担当レイヤー: ドキュメント
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/docs/testing/test-matrix.md`
- 更新ファイル: なし
- 実装する関数シグネチャ: なし
- 実装内容:
  - 要件IDまたはユースケースごとに `unit / integration / e2e / manual` を対応付ける
  - 非機能要件のうち自動テストで担保できないものも明記する
  - 「未自動化」を空欄ではなく明示で残す
- 完了条件:
  - 各主要要件に対して、少なくとも1つの検証方法が割り当てられている
- 依存関係: `docs/design/00-04`, `A-006`, `A-007`
- 並列作業メモ: テスト実装と並行して更新してよい
