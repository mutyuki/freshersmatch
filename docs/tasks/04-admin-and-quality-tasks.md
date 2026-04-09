# 04. 運営・品質タスク

## A-001 運営ログイン/ログアウト API と画面

- 目的: 運営専用 URL からパスコードでログインし、ログアウトできるようにする
- 担当レイヤー: API / UI
- 新規作成ファイル:
  - `../../src/app/admin/login/page.tsx`
  - `../../src/app/api/admin/login/route.ts`
  - `../../src/app/api/admin/logout/route.ts`
  - `../../src/components/admin/admin-login-form.tsx`
  - `../../src/lib/services/admin-auth-service.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function loginAdminWithPasscode(params: { passcode: string }): Promise<{ adminUserId: string }>`
  - `export async function logoutAdmin(): Promise<void>`
  - `export default function AdminLoginPage(): JSX.Element`
- 実装内容:
  - login: `admin_users.passcode_hash` と照合し、成功時に admin session を発行
  - logout: httpOnly cookie を破棄しログイン画面へ遷移
  - PCブラウザ前提の中央寄せログイン画面にする
  - [layout.pen](../../layout.pen) の `Admin / Login` を参考にする
- 完了条件:
  - ログイン成功で `/admin/dashboard` に遷移できる
  - ログアウトAPIを呼ぶとセッションが破棄される
- 依存関係: `F-012`, `F-008`, `F-006`
- 並列作業メモ: `A-002` と並列可能
- 推奨 skill:
  - `freshers-match-admin-ui`
  - `freshers-match-db-api`
- 先に確認するファイル:
  - `../../layout.pen`
  - `../design/03-admin-ops-and-failures.md`
  - `../../src/lib/auth/admin-session.ts`
- おすすめプロンプト:
  - `freshers-match-admin-ui と freshers-match-db-api を使って A-001 を実装してください。admin login ページ、login API、admin-login-form、admin-auth-service を追加し、admin_users.passcode_hash と照合して成功時に admin session を発行してください。PC前提のシンプルで明快なログイン画面にしてください。完了時は pnpm format, pnpm lint, pnpm typecheck, 必要なら pnpm test を実行してください。`

## A-002 運営ダッシュボード

- 目的: 卓、待機者、対戦中、切断者をまとめて見られる画面を作る
- 担当レイヤー: service / UI
- 新規作成ファイル:
  - `../../src/app/admin/dashboard/page.tsx`
  - `../../src/app/api/admin/dashboard/route.ts`
  - `../../src/components/admin/dashboard-summary.tsx`
  - `../../src/lib/services/admin-dashboard-service.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function getAdminDashboardData(eventId: string): Promise<AdminDashboardData>`
  - `export async function GET(request: Request): Promise<Response>`
  - `export default async function AdminDashboardPage(): Promise<JSX.Element>`
- 実装内容:
  - 卓一覧
  - queueing 一覧
  - in_progress 一覧
  - disconnected 一覧
  - dispute 発生試合一覧
  - 停滞試合一覧（`stalledMatches`: `winner_claimed` 状態で `120秒` 以上経過した試合を検出し、要介入として強調表示する）
  - 初回表示は Server Component から `getAdminDashboardData` を直接呼ぶ
  - `/api/admin/dashboard` は Realtime invalidation 後の再同期専用として提供する
  - デスクトップ前提で複数カラム表示にする
  - [layout.pen](../../layout.pen) の `Admin / Dashboard` を参考にする
- 完了条件:
  - 運営が会場状況を一画面で把握できる
  - 停滞試合が一目で分かる
- 依存関係: `A-001`, `M-009`, `F-006`, `F-007`
- 並列作業メモ: `A-003`, `A-004`, `A-005` と並列可能
- 推奨 skill:
  - `freshers-match-admin-ui`
  - `freshers-match-match-flow`
- 先に確認するファイル:
  - `../../layout.pen`
  - `../../.codex/skills/freshers-match-admin-ui/references/operator-actions.md`
  - `../design/03-admin-ops-and-failures.md`
- おすすめプロンプト:
  - `freshers-match-admin-ui と freshers-match-match-flow を使って A-002 を実装してください。admin dashboard page、/api/admin/dashboard、summary component、dashboard service を追加し、卓、待機者、対戦中、切断者、dispute 発生試合を 1 画面で見られる PC 向け複数カラムUI にしてください。page から直接 DB を触らず、初回は Server Component から dashboard service を直接呼び、以後は Realtime invalidation で dashboard API を再取得する構成にしてください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## A-003 運営 participant 操作

- 目的: チップ修正、一時停止、失格 API と UI を実装する
- 担当レイヤー: service / API / UI
- 新規作成ファイル:
  - `../../src/app/admin/participants/page.tsx`
  - `../../src/app/api/admin/participants/route.ts`
  - `../../src/app/api/admin/participant/chip-adjust/route.ts`
  - `../../src/app/api/admin/participant/pause/route.ts`
  - `../../src/app/api/admin/participant/unpause/route.ts`
  - `../../src/app/api/admin/participant/disqualify/route.ts`
  - `../../src/components/admin/participant-table.tsx`
  - `../../src/lib/services/admin-participant-service.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function GET(request: Request): Promise<Response>`
  - `export async function adjustParticipantChip(params: { adminUserId: string; participantId: string; delta: number; reason: string }): Promise<void>`
  - `export async function pauseParticipant(params: { adminUserId: string; participantId: string }): Promise<void>`
  - `export async function unpauseParticipant(params: { adminUserId: string; participantId: string }): Promise<void>`
  - `export async function disqualifyParticipant(params: { adminUserId: string; participantId: string; mode: "void_current_match" | "lose_current_match" }): Promise<void>`
  - `export async function listAdminParticipants(eventId: string): Promise<Array<{ participantId: string; nickname: string; status: ParticipantStatus; chipBalance: number; currentMatchId: string | null; lastSeenAt: string; disqualifiedReason: string | null }>>`
- 実装内容:
  - chip ledger 追記
  - paused / disqualified 反映
  - paused 解除
  - 対戦中失格時の分岐処理
  - participants page の初期表示用 read service (SSR) を提供し、以後の更新は `GET /api/admin/participants` を Realtime invalidation 受信時だけ再取得するよう実装する
  - 成功時に `publishInvalidation` を呼ぶ。チップ修正は少なくとも `participant`, `admin`, `ranking`、pause / unpause / disqualify は少なくとも `participant`, `admin` を通知する
  - [layout.pen](../../layout.pen) の `Admin / Participants` を参考にする
- 完了条件:
  - 参加者に対して必要な3操作が実行できる
- 依存関係: `A-001`, `M-004`, `F-006`, `F-013c`, `F-013d`, `F-014`
- 並列作業メモ: `A-004`, `A-005` と並列可能
- 推奨 skill:
  - `freshers-match-admin-ui`
  - `freshers-match-match-flow`
  - `freshers-match-testing`
- 先に確認するファイル:
  - `../design/03-admin-ops-and-failures.md`
  - `../testing/test-matrix.md`
  - `../../.codex/skills/freshers-match-admin-ui/references/operator-actions.md`
- おすすめプロンプト:
  - `freshers-match-admin-ui と freshers-match-match-flow を使って A-003 を実装してください。participants 管理画面、chip-adjust / pause / disqualify API、participant table、admin-participant-service を追加し、chip ledger 追記、一時停止、失格、対戦中失格の2モードを実装してください。加えて participants page の server-side read 用に listAdminParticipants を用意し、一覧表示の取得契約も固定してください。運営の誤操作を避けるため確認導線も意識してください。完了時は pnpm format, pnpm lint, pnpm typecheck, 影響範囲に応じて pnpm test を実行してください。`

## A-004 運営 match / table 操作

- 目的: 卓強制解放、試合無効、勝敗修正、admin_hold 切り替えを実装する
- 担当レイヤー: service / API / UI
- 新規作成ファイル:
  - `../../src/app/admin/matches/page.tsx`
  - `../../src/app/admin/tables/page.tsx`
  - `../../src/app/api/admin/matches/route.ts`
  - `../../src/app/api/admin/tables/route.ts`
  - `../../src/app/api/admin/table/force-release/route.ts`
  - `../../src/app/api/admin/table/hold/route.ts`
  - `../../src/app/api/admin/table/release-hold/route.ts`
  - `../../src/app/api/admin/match/resolve/route.ts`
  - `../../src/components/admin/match-table.tsx`
  - `../../src/components/admin/table-grid.tsx`
  - `../../src/lib/services/admin-match-service.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function GET(request: Request): Promise<Response>`
  - `export async function forceReleaseTable(params: { adminUserId: string; tableId: string }): Promise<void>`
  - `export async function holdTable(params: { adminUserId: string; tableId: string }): Promise<void>`
  - `export async function releaseTableHold(params: { adminUserId: string; tableId: string }): Promise<void>`
  - `export async function resolveMatchByAdmin(params: { adminUserId: string; matchId: string; resolution: { type: "void" } | { type: "winner"; winnerParticipantId: string } }): Promise<void>`
  - `export async function listAdminMatches(eventId: string): Promise<Array<{ matchId: string; tableNumber: number | null; status: MatchStatus; participant1Nickname: string; participant2Nickname: string | null; startedAt: string | null; disputeCount: number }>>`
  - `export async function listAdminTables(eventId: string): Promise<Array<{ tableId: string; tableNumber: number; gameTitle: string; status: TableStatus; currentMatchId: string | null; occupantNicknames: string[]; heldByAdminDisplayName: string | null }>>`
- 実装内容:
  - 卓解放
  - 卓 admin_hold 切り替え（hold / release-hold）
  - 試合無効
  - 運営による勝敗確定
  - `resolveMatchByAdmin` の service 入力 `resolution` は、RPC `resolve_match_by_admin` の `p_resolution_type` と `p_winner_participant_id` へ 1:1 で変換する
  - 参加者状態復旧
  - matches / tables page の初期表示用 read service (SSR) を提供し、以後の更新は `GET /api/admin/matches`, `GET /api/admin/tables` を Realtime invalidation 受信時だけ再取得するよう実装する
  - 成功時に `publishInvalidation` を呼ぶ。試合無効・勝敗確定は少なくとも `participant`, `match`, `admin`、順位変動がある場合は `ranking` を通知する。卓解放・hold 切り替えは少なくとも `admin` を通知する
  - [layout.pen](../../layout.pen) の `Admin / Matches` と `Admin / Tables` を参考にする
- 完了条件:
  - 試合トラブルを運営が手動復旧できる
  - 運営が卓を hold / 解除できる
- 依存関係: `A-001`, `M-004`, `F-006`, `F-013d`, `F-013e`, `F-014`
- 並列作業メモ: `A-003`, `A-005` と並列可能
- 推奨 skill:
  - `freshers-match-admin-ui`
  - `freshers-match-match-flow`
  - `freshers-match-testing`
- 先に確認するファイル:
  - `../../layout.pen`
  - `../design/03-admin-ops-and-failures.md`
  - `../../src/lib/services/match-service.ts`
- おすすめプロンプト:
  - `freshers-match-admin-ui と freshers-match-match-flow を使って A-004 を実装してください。matches/tables 画面、force-release API、resolve API、match-table、table-grid、admin-match-service を追加し、卓強制解放、試合無効、運営による勝敗確定、参加者状態復旧を実装してください。加えて matches / tables page の server-side read 用に listAdminMatches と listAdminTables を用意し、一覧表示の取得契約も固定してください。トラブル時の手動復旧を最優先にしてください。完了時は pnpm format, pnpm lint, pnpm typecheck, 影響範囲に応じて pnpm test を実行してください。`

## A-005 運営戦開始と結果確定

- 目的: 待機者に対して運営戦を手動で開始し、運営側で結果確定できるようにする
- 担当レイヤー: service / API / UI
- 新規作成ファイル:
  - `../../src/app/api/admin/staff-match/start/route.ts`
  - `../../src/app/api/admin/staff-match/resolve/route.ts`
  - `../../src/components/admin/staff-match-form.tsx`
  - `../../src/lib/services/staff-match-service.ts`
- 更新ファイル:
  - `../../src/app/admin/dashboard/page.tsx`
- 実装する関数シグネチャ:
  - `export async function startStaffMatch(params: { adminUserId: string; participantId: string; optionalTableId?: string }): Promise<string>`
  - `export async function resolveStaffMatch(params: { adminUserId: string; matchId: string; participantWon: boolean }): Promise<void>`
- 実装内容:
  - 待機中 participant と空き卓を使って `is_staff_match=true` の match を作る
  - 運営戦の結果を運営画面から確定する
  - participant 勝利時だけ payout を反映する
  - 運営戦結果確定時は `completed_at` 設定、`result_confirmed` 遷移、`current_match_id` 保持を `ack` まで維持する
  - 成功時に `publishInvalidation` を呼ぶ。開始時は少なくとも `participant`, `match`, `admin`、結果確定時は `participant`, `match`, `admin`, `ranking` を通知する
  - 実装導線は [layout.pen](../../layout.pen) の `Admin / Dashboard` 上の操作導線を参考にする
- 完了条件:
  - 運営が任意の待機者を運営戦へ進め、結果確定まで完了できる
- 依存関係: `A-001`, `M-001`, `F-006`, `F-013e`, `F-014`
- 並列作業メモ: `A-003`, `A-004` と並列可能
- 推奨 skill:
  - `freshers-match-admin-ui`
  - `freshers-match-match-flow`
- 先に確認するファイル:
  - `../../layout.pen`
  - `../../src/lib/services/matching-service.ts`
  - `../design/03-admin-ops-and-failures.md`
- おすすめプロンプト:
  - `freshers-match-admin-ui と freshers-match-match-flow を使って A-005 を実装してください。staff-match start / resolve API、StaffMatchForm、staff-match-service を追加し、待機中 participant と空き卓を使って is_staff_match=true の match を作成し、運営側で結果確定まで完了できるようにしてください。運営戦成立後は差し替えない要件を守り、participant 勝利時のみ payout を反映してください。完了時は pnpm format, pnpm lint, pnpm typecheck を実行してください。`

## A-006 例外系統合テスト

- 目的: 状態競合や異常系を回帰テストで固定する
- 担当レイヤー: integration test
- 新規作成ファイル:
  - `../../src/tests/integration/participant-flow.test.ts`
  - `../../src/tests/integration/matching-flow.test.ts`
  - `../../src/tests/integration/admin-ops.test.ts`
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
  - 対戦中失格の2モード（void_current_match / lose_current_match）
  - 卓不足時に match 未作成
  - admin_hold 中の卓がマッチング対象にならない
  - admin_hold 切り替えと解除の正常動作
  - unpause で registered に戻る
  - 運営戦中に卓強制解放しようとした場合の副作用
- 完了条件:
  - 主要例外ケースがテストで固定される
  - 各ケースで participant, match, table, ledger の整合性を明示 assertion している
- 依存関係: `P-002`, `M-005`, `A-003`, `A-004`, `A-005`
- 並列作業メモ: UIタスクとは独立して進めやすい
- 推奨 skill:
  - `freshers-match-testing`
  - `freshers-match-match-flow`
- 先に確認するファイル:
  - `../testing/test-matrix.md`
  - `../../.codex/skills/freshers-match-testing/references/regression-priority.md`
  - `../../src/lib/services`
- おすすめプロンプト:
  - `freshers-match-testing と freshers-match-match-flow を使って A-006 を実装してください。participant-flow, matching-flow, admin-ops の integration test を追加し、ニックネーム重複、開始前キャンセル、承認拒否、運営修正、旧トークン拒否、運営戦、ready/cancel 競合、二重承認防止、卓不足、対戦中失格の2モードを明示 assertion してください。participant, match, table, ledger の整合性を必ず確認してください。完了時は pnpm format, pnpm lint, pnpm typecheck, pnpm test を実行してください。`

## A-007 E2E 最小導線

- 目的: MVP必須フローをブラウザ操作で担保する
- 担当レイヤー: E2E test
- 新規作成ファイル:
  - `../../src/tests/e2e/join-and-match.spec.ts`
  - `../../src/tests/e2e/admin-resolve.spec.ts`
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
- 推奨 skill:
  - `freshers-match-testing`
  - `freshers-match-participant-ui`
  - `freshers-match-admin-ui`
- 先に確認するファイル:
  - `../testing/test-matrix.md`
  - `../../playwright.config.ts`
  - `../../layout.pen`
- おすすめプロンプト:
  - `freshers-match-testing を使って A-007 を実装してください。join-and-match.spec.ts と admin-resolve.spec.ts を追加し、参加者2人の登録から試合完了、承認拒否後の継続、再接続復帰、運営によるトラブル解決までの最短導線を E2E で固定してください。UI の文言や role は安定して取得できる形にしてください。完了時は pnpm format, pnpm lint, pnpm typecheck, pnpm test:e2e を実行してください。`

## A-008 運営向け運用メモ

- 目的: 当日運営の復旧手順を短く明文化する
- 担当レイヤー: ドキュメント
- 新規作成ファイル:
  - `../operations/event-day-runbook.md`
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
- 推奨 skill:
  - `freshers-match-admin-ui`
  - `freshers-match-overview`
- 先に確認するファイル:
  - `../design/03-admin-ops-and-failures.md`
  - `../../layout.pen`
  - `../../.codex/skills/freshers-match-admin-ui/references/operator-actions.md`
- おすすめプロンプト:
  - `freshers-match-overview と freshers-match-admin-ui を使って A-008 を実装してください。docs/operations/event-day-runbook.md に、接続切れ、承認拒否、卓解放、失格、運営戦開始など当日運営で困りやすいケースの対処手順を 5 分で読める長さでまとめてください。画面名と押す場所が分かるようにしてください。`

## A-009 並列実装のおすすめ順

このセクションはタスクではなく、並列作業のまとまりを示す。

### レーン1

- `F-001` → `F-003` → `F-004` → `F-006`

### レーン2

- `F-002` → `P-003` → `P-004`

### レーン3

- `F-007` → `F-008` → `F-009` と `F-010`

### レーン4

- `F-011` → `P-001` → `P-002` → `P-005` → `F-015`

### レーン5

- `F-013a` → `F-013b`
- `F-013a` → `F-013c` / `F-013d` / `F-013e`（相互に並列可能）
- `F-013b` + `F-013c` + `F-013d` + `F-013e` → `F-014`

### レーン6

- `M-001` → `M-002` → `M-003`

### レーン7

- `M-004` → `M-005` → `M-006`

### レーン8

- `F-012` → `F-016` → `A-001` → `A-002` → `A-003` / `A-004` / `A-005`

### レーン9

- `A-006` → `A-007` → `A-008`

## A-010 テストマトリクス文書

- 目的: どの要件をどの層のテストで担保するかを明文化し、テスト漏れを防ぐ
- 担当レイヤー: ドキュメント
- 新規作成ファイル:
  - `../testing/test-matrix.md`
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
- 推奨 skill:
  - `freshers-match-testing`
  - `freshers-match-overview`
- 先に確認するファイル:
  - `../design/README.md`
  - `../testing/test-matrix.md`
  - `../../.codex/skills/freshers-match-testing/references/regression-priority.md`
- おすすめプロンプト:
  - `freshers-match-testing と freshers-match-overview を使って A-010 を更新してください。要件ごとに unit / integration / e2e / manual の担当を整理し、未自動化の箇所も明示してください。実装済みテストとの差分が分かるように書いてください。`
