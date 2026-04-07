# 02. 参加者フロータスク

## P-001 参加者サービス

- 目的: 参加者登録、取得、状態復元のサービスをまとめる
- 担当レイヤー: service
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/services/participant-service.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function registerParticipant(params: { venueCode: string; nickname: string }): Promise<{ participant: ParticipantRow; sessionToken: string }>`
  - `export async function restoreParticipantSession(params: { sessionToken: string }): Promise<ParticipantRuntimeState>`
  - `export async function getParticipantRuntimeState(participantId: string): Promise<ParticipantRuntimeState>`
  - `export async function heartbeatParticipant(params: { sessionToken: string }): Promise<void>`
- 実装内容:
  - 会場コード確認
  - ニックネーム一意制御
  - 旧セッション無効化
  - 新規セッション発行
  - `current_match_id`, `table`, `opponent` をまとめて返す
- 完了条件:
  - 参加者の現在状態を画面がそのまま使える形で返す
- 依存関係: `F-006`, `F-008`, `F-011`
- 並列作業メモ: `P-002` と同時に進めない

## P-002 参加者API

- 目的: 参加登録・復元・heartbeat API を作る
- 担当レイヤー: API
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/api/participant/register/route.ts`
  - `/Users/kitamurareiki/develop/match/src/app/api/participant/session/restore/route.ts`
  - `/Users/kitamurareiki/develop/match/src/app/api/participant/heartbeat/route.ts`
  - `/Users/kitamurareiki/develop/match/src/lib/api/response.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function POST(request: Request): Promise<Response>`
  - `export function okJson<T>(data: T, init?: ResponseInit): Response`
  - `export function errorJson(error: AppError | Error): Response`
- 実装内容:
  - body を zod で検証
  - service を呼ぶ
  - 共通 JSON レスポンスを返す
- 完了条件:
  - 3 API が疎通し、異常系も JSON で返る
- 依存関係: `P-001`
- 並列作業メモ: `P-003` と並列可能

## P-003 参加者画面シェル

- 目的: 参加者向けの共通レイアウトと状態取得導線を作る
- 担当レイヤー: UI
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/(participant)/layout.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/participant/participant-shell.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/participant/status-badge.tsx`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export default function ParticipantLayout(props: Readonly<{ children: React.ReactNode }>): JSX.Element`
  - `export function ParticipantShell(props: { title: string; children: React.ReactNode }): JSX.Element`
  - `export function StatusBadge(props: { status: ParticipantStatus }): JSX.Element`
- 実装内容:
  - 参加者画面共通の余白、ヘッダー、カード幅を定義する
  - `max-w-md mx-auto` のモバイルファースト前提で組む
  - 下部主要ボタンを置きやすい縦レイアウトにする
  - [layout.pen](/Users/kitamurareiki/develop/match/layout.pen) の参加者画面を基準にしつつ、実装時に余白、タイポグラフィ、ボタンサイズ、画面遷移導線を改善して仕上げる
- 完了条件:
  - 各ページが同じ UI 骨組みで実装できる
- 依存関係: `F-002`, `F-007`
- 並列作業メモ: `P-002`, `P-004` と並列可能

## P-004 参加登録画面

- 目的: QR 遷移先から参加登録できる画面を作る
- 担当レイヤー: UI
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/(participant)/join/page.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/participant/join-form.tsx`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export default function JoinPage(): JSX.Element`
  - `export function JoinForm(): JSX.Element`
- 実装内容:
  - 会場コード入力欄
  - ニックネーム入力欄
  - submit 時に `POST /api/participant/register`
  - 成功時にトークン保存してホームへ遷移
  - スマホ片手操作を前提に、入力欄と確定ボタンを縦積みにする
  - [layout.pen](/Users/kitamurareiki/develop/match/layout.pen) の `Participant / Join` を参考にする
- 完了条件:
  - 重複ニックネームと会場コード不正が画面に表示される
- 依存関係: `P-002`, `P-003`
- 並列作業メモ: `P-005` と並列可能

## P-005 セッション復元フック

- 目的: 再読み込み時の状態復元処理を共通化する
- 担当レイヤー: UI / client state
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/session/participant-client-session.ts`
  - `/Users/kitamurareiki/develop/match/src/hooks/useParticipantRuntime.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export function saveParticipantSessionToken(token: string): void`
  - `export function getParticipantSessionToken(): string | null`
  - `export function clearParticipantSessionToken(): void`
  - `export function useParticipantRuntime(): { state: ParticipantRuntimeState | null; isLoading: boolean; refresh: () => Promise<void> }`
- 実装内容:
  - ローカル保存したトークンで `/api/participant/session/restore` を叩く
  - 復元結果をページで再利用できるようにする
- 完了条件:
  - 再読み込み後に現在画面へ復帰できる状態が取れる
- 依存関係: `P-002`
- 並列作業メモ: `P-004` と並列可能

## P-006 参加者ホーム画面

- 目的: 参加者が現在の状態とチップ数を確認し、マッチング開始できる画面を作る
- 担当レイヤー: UI
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/(participant)/home/page.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/participant/home-panel.tsx`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export default function HomePage(): JSX.Element`
  - `export function HomePanel(props: { runtime: ParticipantRuntimeState }): JSX.Element`
- 実装内容:
  - チップ数、現在状態、現在の卓情報、ランキング導線を表示する
  - マッチング開始ボタンを置く
  - 主要操作を縦1カラムで配置する
  - [layout.pen](/Users/kitamurareiki/develop/match/layout.pen) の `Participant / Home` を参考にする
- 完了条件:
  - 登録済み参加者がホームで必要情報を確認できる
- 依存関係: `P-003`, `P-005`, `M-002`
- 並列作業メモ: `P-007` と並列可能

## P-007 ランキングサービスとAPI

- 目的: 総チップ所持数ランキングを取得できるようにする
- 担当レイヤー: service / API
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/lib/services/ranking-service.ts`
  - `/Users/kitamurareiki/develop/match/src/app/api/ranking/route.ts`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export async function listRanking(params: { eventId: string }): Promise<RankingEntry[]>`
  - `export async function GET(request: Request): Promise<Response>`
- 実装内容:
  - `chip_balance DESC, updated_at ASC, id ASC` でソートする
  - 失格者は `is_disqualified` を表示データへ反映する
- 完了条件:
  - API からランキング一覧が返る
- 依存関係: `F-006`
- 並列作業メモ: `P-008` と並列可能

## P-008 ランキング画面

- 目的: 参加者用とモニター用のランキング UI を作る
- 担当レイヤー: UI
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/app/(participant)/ranking/page.tsx`
  - `/Users/kitamurareiki/develop/match/src/app/monitor/ranking/page.tsx`
  - `/Users/kitamurareiki/develop/match/src/components/ranking/ranking-list.tsx`
- 更新ファイル: なし
- 実装する関数シグネチャ:
  - `export default function ParticipantRankingPage(): JSX.Element`
  - `export function RankingList(props: { entries: RankingEntry[]; highlightParticipantId?: string }): JSX.Element`
- 実装内容:
  - ランキング一覧
  - 自分の行のハイライト
  - モニター用は余計な操作を持たない
- 完了条件:
  - 参加者画面とモニター画面の両方で一覧が見える
- 依存関係: `P-007`, `P-003`
- 並列作業メモ: `P-006` と並列可能

## P-009 heartbeat 実装

- 目的: 30秒切断判定のために定期 heartbeat を送る
- 担当レイヤー: UI / client infra
- 新規作成ファイル:
  - `/Users/kitamurareiki/develop/match/src/hooks/useParticipantHeartbeat.ts`
- 更新ファイル:
  - `/Users/kitamurareiki/develop/match/src/components/participant/participant-shell.tsx`
- 実装する関数シグネチャ:
  - `export function useParticipantHeartbeat(enabled: boolean): void`
- 実装内容:
  - セッショントークンがあるとき定期で `/api/participant/heartbeat` を呼ぶ
- 完了条件:
  - 開いている参加者端末から `last_seen_at` が更新される
- 依存関係: `P-002`, `P-005`
- 並列作業メモ: `P-006`, `P-008` と並列可能
