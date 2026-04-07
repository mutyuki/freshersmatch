# 03. マッチフロータスク

## M-001 マッチングサービス

- 目的: 対人優先ランダムマッチングと卓仮予約を行う中核ロジックを実装する
- 担当レイヤー: service
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/services/matching-service.ts`
  - `/Users/kitamurareiki/develop/match/src/tests/unit/matching-service.test.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function executeStartQueue(params: { participantId: string }): Promise<ParticipantRuntimeState>`
  - `export async function executeCancelQueue(params: { participantId: string }): Promise<ParticipantRuntimeState>`
  - `export async function tryCreateNextMatch(eventId: string): Promise<MatchRow | null>`
  - `export function chooseOpponent(params: { requesterId: string; queuedParticipants: ParticipantRow[] }): ParticipantRow | null`
  - `export function shouldOfferStaffMatch(params: { queuedAt: string; now: Date; staffMatchWaitSeconds: number }): boolean`
- 実装内容:
  - queueing 登録
  - 空き卓取得
  - 直前対戦相手回避
  - 候補不足時の制約解除
  - match / participants / tables の一括更新
- 完了条件:
  - 2人待機で match が作られ、卓が `reserved` になる
- 依存関係: `F-006`, `F-007`, `F-010`
- 並列作業メモ: `M-002` と同時に進めない

## M-002 マッチングAPI

- 目的: 待機開始 / 待機解除 API を作る
- 担当レイヤー: API
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/api/matching/start/route.ts`
  - `/Users/kitamurareiki/develop/match/src/app/api/matching/cancel/route.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function POST(request: Request): Promise<Response>`
- 実装内容:
  - セッションから本人特定
  - queue 開始 / 解除
  - レスポンスに現在状態を返す
- 完了条件:
  - 待機開始と待機解除が UI から呼べる
- 依存関係: `M-001`, `F-011`
- 並列作業メモ: `M-003` と並列可能

## M-003 待機画面とマッチ成立画面

- 目的: 待機中UIとマッチ成立UIを作る
- 担当レイヤー: UI
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/(participant)/match/page.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/participant/queue-panel.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/participant/match-reserved-panel.tsx`
- 更新ファイル:
  - `/Users/kitamurareiki/develop/match/src/components/participant/home-panel.tsx`
- 実装する関数シグネチャ:
  - `export default function MatchPage(): JSX.Element`
  - `export function QueuePanel(props: { runtime: ParticipantRuntimeState }): JSX.Element`
  - `export function MatchReservedPanel(props: { runtime: ParticipantRuntimeState }): JSX.Element`
- 実装内容:
  - 待機時間表示
  - マッチ成立後に卓番号、ゲーム名、相手名を表示
  - 開始 / キャンセルボタンの置き場所を確保
  - [layout.pen](/Users/kitamurareiki/develop/match/layout.pen) の `Participant / Queue` と `Participant / Match Reserved` を参考にする
- 完了条件:
  - 状態に応じて待機画面と成立画面が切り替わる
- 依存関係: `P-003`, `P-005`, `M-002`
- 並列作業メモ: `M-004` と並列可能

## M-004 試合サービス

- 目的: 開始、開始前キャンセル、勝利申告、承認、拒否、結果確定を実装する
- 担当レイヤー: service
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/services/match-service.ts`
  - `/Users/kitamurareiki/develop/match/src/tests/integration/match-service.test.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function executeReadyMatch(params: { participantId: string; matchId: string }): Promise<ParticipantRuntimeState>`
  - `export async function executeCancelBeforeStart(params: { participantId: string; matchId: string }): Promise<void>`
  - `export async function executeClaimWin(params: { participantId: string; matchId: string }): Promise<ParticipantRuntimeState>`
  - `export async function executeApproveResult(params: { participantId: string; matchId: string; approve: boolean }): Promise<ParticipantRuntimeState>`
  - `export async function completeMatchAndApplyChipLedger(params: { matchId: string; winnerParticipantId: string }): Promise<void>`
- 実装内容:
  - ready の同時押下
  - bet 差し引き
  - `winner_claimed` 化
  - 承認拒否時の差し戻し
  - 承認成功時の ledger 反映、卓解放、状態復帰
- 完了条件:
  - 対人戦と運営戦の両方の結果確定が通る
- 依存関係: `F-009`, `F-010`, `F-006`
- 並列作業メモ: `M-005` と並列可能

## M-005 試合API

- 目的: 試合操作用 API を作る
- 担当レイヤー: API
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/api/match/ready/route.ts`
  - `/Users/kitamurareiki/develop/match/src/app/api/match/cancel-before-start/route.ts`
  - `/Users/kitamurareiki/develop/match/src/app/api/match/claim-win/route.ts`
  - `/Users/kitamurareiki/develop/match/src/app/api/match/approve-result/route.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function POST(request: Request): Promise<Response>`
- 実装内容:
  - セッション検証
  - body 検証
  - service 呼び出し
- 完了条件:
  - 4 API が完成し、異常系 409 / 401 / 400 が返る
- 依存関係: `M-004`, `F-011`, `F-008`
- 並列作業メモ: `M-006` と並列可能

## M-006 対戦中・勝利申告・承認 UI

- 目的: 試合開始後の参加者操作 UI を作る
- 担当レイヤー: UI
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/components/participant/in-progress-panel.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/participant/result-approval-panel.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/participant/result-confirmed-panel.tsx`
- 更新ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/(participant)/match/page.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/participant/match-reserved-panel.tsx`
- 実装する関数シグネチャ:
  - `export function InProgressPanel(props: { runtime: ParticipantRuntimeState }): JSX.Element`
  - `export function ResultApprovalPanel(props: { runtime: ParticipantRuntimeState }): JSX.Element`
  - `export function ResultConfirmedPanel(props: { runtime: ParticipantRuntimeState }): JSX.Element`
- 実装内容:
  - 開始ボタン
  - キャンセルボタン
  - 勝利申告
  - 承認 / 承認しない
  - 結果確定表示
  - [layout.pen](/Users/kitamurareiki/develop/match/layout.pen) の `Participant / In Progress`、`Participant / Claim Waiting`、`Participant / Result Approval`、`Participant / Result Confirmed` を参考にする
- 完了条件:
  - 参加者が試合開始から結果確定まで UI 上で完結できる
- 依存関係: `M-005`, `M-003`
- 並列作業メモ: `M-007` と並列可能

## M-007 リアルタイム購読基盤

- 目的: participant / match / table の更新を画面へ反映する
- 担当レイヤー: realtime
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/realtime/channels.ts`
  - `/Users/kitamurareiki/develop/match/src/lib/realtime/subscriptions.ts`
  - `/Users/kitamurareiki/develop/match/src/hooks/useParticipantRealtime.ts`
  - `/Users/kitamurareiki/develop/match/src/hooks/useRankingRealtime.ts`
- 更新ファイル:
  - `/Users/kitamurareiki/develop/match/src/hooks/useParticipantRuntime.ts`
  - `/Users/kitamurareiki/develop/match/src/app/(participant)/ranking/page.tsx`
  - `/Users/kitamurareiki/develop/match/src/app/monitor/ranking/page.tsx`
- 実装する関数シグネチャ:
  - `export function participantChannelName(eventId: string, participantId: string): string`
  - `export function useParticipantRealtime(params: { eventId: string; participantId: string; onChange: () => Promise<void> }): void`
  - `export function useRankingRealtime(params: { eventId: string; onChange: () => Promise<void> }): void`
- 実装内容:
  - participant, match, table の更新時に runtime refresh を呼ぶ
  - ranking ページで再読込する
- 完了条件:
  - マッチ成立、開始、結果確定、ランキング更新がリロードなしで反映される
- 依存関係: `F-003`, `P-005`, `P-007`
- 並列作業メモ: `M-006` と並列可能

## M-008 接続切れ判定ヘルパ

- 目的: 接続切れ participant を判定する共通ロジックを作る
- 担当レイヤー: service helper
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/domain/disconnect-rules.ts`
  - `/Users/kitamurareiki/develop/match/src/tests/unit/disconnect-rules.test.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export function isDisconnected(params: { lastSeenAt: string; now: Date; disconnectThresholdSeconds: number }): boolean`
- 実装内容:
  - `last_seen_at` と閾値から切断を判定する
- 完了条件:
  - 境界値テストが揃う
- 依存関係: `F-007`
- 並列作業メモ: `A-002` と並列可能
