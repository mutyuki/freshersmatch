"use client";

import { useEffect, useMemo, useState, type JSX } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useParticipantHeartbeat } from "@/hooks/useParticipantHeartbeat";
import { useParticipantRuntime } from "@/hooks/useParticipantRuntime";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";
import { PARTICIPANT_RUNTIME_UPDATED_EVENT } from "@/lib/participant-runtime-events";
import { participantStatusConfig } from "@/lib/ui/participant-status";
import { cn } from "@/lib/utils";
import {
  formatBetAmount,
  formatResultConfirmedAt,
  formatResultDelta,
  getMatchLocationSummary,
  getOpponentLabel,
  postParticipantAction,
  publishRuntimeUpdate,
} from "@/components/participant/match-panel-utils";

function StatusPill({ status }: { status: ParticipantRuntimeState["status"] }): JSX.Element {
  const config = participantStatusConfig[status];

  return (
    <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs", config.className)}>
      {config.label}
    </Badge>
  );
}

function getElapsedSeconds(queuedAt: string | null, now: number): number | null {
  if (!queuedAt) {
    return null;
  }

  const queuedAtMs = new Date(queuedAt).getTime();
  if (Number.isNaN(queuedAtMs)) {
    return null;
  }

  return Math.max(0, Math.floor((now - queuedAtMs) / 1000));
}

function formatElapsedTime(seconds: number | null): string {
  if (seconds === null) {
    return "--:--";
  }
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function ReconnectingOverlay(): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <CardTitle>再接続中...</CardTitle>
          <CardDescription>
            接続を復旧しています。復帰先の画面へ自動で戻るまで、このままお待ちください。
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default function MatchPage(): JSX.Element {
  const router = useRouter();
  const { state, isLoading } = useParticipantRuntime();
  const [runtime, setRuntime] = useState<ParticipantRuntimeState | null>(state);
  const [now, setNow] = useState(() => Date.now());
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resolvedRuntime = runtime ?? state;

  useParticipantHeartbeat(!isLoading && Boolean(resolvedRuntime));

  useEffect(() => {
    setRuntime(state);
  }, [state]);

  useEffect(() => {
    function handleRuntimeUpdated(event: Event): void {
      const customEvent = event as CustomEvent<ParticipantRuntimeState>;
      setRuntime(customEvent.detail);
    }

    window.addEventListener(PARTICIPANT_RUNTIME_UPDATED_EVENT, handleRuntimeUpdated);
    return () => {
      window.removeEventListener(PARTICIPANT_RUNTIME_UPDATED_EVENT, handleRuntimeUpdated);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isLoading && !resolvedRuntime) {
      router.replace("/join");
    }
  }, [isLoading, resolvedRuntime, router]);

  const elapsedSeconds = useMemo(
    () => getElapsedSeconds(resolvedRuntime?.queuedAt ?? null, now),
    [now, resolvedRuntime?.queuedAt],
  );

  async function runParticipantAction(
    action: string,
    promise: Promise<ParticipantRuntimeState | { ok: true }>,
    onSuccess?: () => void,
  ): Promise<void> {
    if (pendingAction) {
      return;
    }
    setPendingAction(action);
    setErrorMessage(null);
    try {
      const result = await promise;
      if (typeof result === "object" && result && "eventId" in result) {
        publishRuntimeUpdate(result);
      } else if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "操作に失敗しました。");
    } finally {
      setPendingAction(null);
    }
  }

  const title =
    isLoading || !resolvedRuntime ? "対戦案内を確認しています..." : "次の卓案内を確認する";

  return (
    <main className="flex min-h-full flex-col gap-4">
      <header className="space-y-2 px-1 pb-2 pt-1">
        <div className="space-y-2">
          <p className="text-sm leading-6 text-muted-foreground">
            いま必要な情報だけを、片手で迷わず操作できる並びで表示します。
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        </div>
      </header>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6 text-sm leading-6 text-muted-foreground">
            保存済みの参加情報を読み込み中です。待機状況や卓案内があれば、この画面にすぐ反映します。
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !resolvedRuntime ? (
        <Card>
          <CardContent className="pt-6 text-sm leading-6 text-muted-foreground">
            セッションが見つからないため、参加登録画面へ戻ります。
          </CardContent>
        </Card>
      ) : null}

      {resolvedRuntime ? (
        <div className="space-y-4">
          {resolvedRuntime.status === "queueing" ? (
            <Card>
              <CardHeader>
                <StatusPill status="queueing" />
                <CardTitle>次の卓を探しています</CardTitle>
                <CardDescription>
                  人対人を優先して、空いている卓へ順番に案内します。画面が切り替わったらそのまま卓へ向かってください。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Wait time</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
                    {formatElapsedTime(elapsedSeconds)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {elapsedSeconds === null
                      ? "待機開始時刻を確認しています。数秒たっても更新されない場合は近くのスタッフへ知らせてください。"
                      : "最後に戦った相手は可能なら避けつつ、部屋の回転が止まらないようにマッチを探しています。"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={pendingAction !== null}
                  onClick={() =>
                    void runParticipantAction(
                      "cancel",
                      postParticipantAction<{ ok: true }>("/api/matching/cancel", {
                        defaultErrorMessage:
                          "待機の終了に失敗しました。少し待ってからもう一度お試しください。",
                      }),
                      () => router.push("/home"),
                    )
                  }
                  className="h-12 w-full"
                >
                  {pendingAction === "cancel" ? "待機を終了しています..." : "待機をやめる"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {resolvedRuntime.status === "match_reserved" || resolvedRuntime.status === "ready" ? (
            <Card>
              <CardHeader>
                <StatusPill status={resolvedRuntime.status} />
                <CardTitle>
                  {resolvedRuntime.status === "ready"
                    ? "相手の準備完了を待っています"
                    : "卓が確定しました。すぐ向かってください"}
                </CardTitle>
                <CardDescription>
                  卓番号と相手を確認して、迷わずその卓へ向かってください。開始前の確認はこの画面にまとまっています。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Table</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                    {resolvedRuntime.table ? `${resolvedRuntime.table.tableNumber} 卓` : "確認中"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {resolvedRuntime.table?.gameTitle ?? "卓情報を確認しています"}
                  </p>
                </div>
                <div className="space-y-2 rounded-lg border p-4 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">対戦相手</span>
                    <span className="font-semibold text-foreground">
                      {getOpponentLabel(resolvedRuntime)}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  size="lg"
                  disabled={
                    resolvedRuntime.status === "ready" ||
                    !resolvedRuntime.table ||
                    !resolvedRuntime.currentMatchId ||
                    pendingAction !== null
                  }
                  onClick={() =>
                    void runParticipantAction(
                      "ready",
                      postParticipantAction<ParticipantRuntimeState>("/api/match/ready", {
                        body: { matchId: resolvedRuntime.currentMatchId },
                        defaultErrorMessage:
                          "対戦開始に失敗しました。通信状況を確認してから、もう一度お試しください。",
                      }),
                    )
                  }
                  className="h-12 w-full"
                >
                  {pendingAction === "ready"
                    ? "対戦を開始しています..."
                    : resolvedRuntime.status === "ready"
                      ? "相手の到着を待っています"
                      : "対戦を開始する"}
                </Button>
                {resolvedRuntime.status !== "ready" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={!resolvedRuntime.currentMatchId || pendingAction !== null}
                    onClick={() =>
                      void runParticipantAction(
                        "cancel-before-start",
                        postParticipantAction<{ ok: true }>("/api/match/cancel-before-start", {
                          body: { matchId: resolvedRuntime.currentMatchId },
                          defaultErrorMessage:
                            "開始前キャンセルに失敗しました。時間をおいてもう一度お試しください。",
                        }),
                        () => router.push("/home"),
                      )
                    }
                    className="h-12 w-full"
                  >
                    {pendingAction === "cancel-before-start"
                      ? "開始前キャンセルを送信しています..."
                      : "開始前キャンセル"}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {resolvedRuntime.status === "playing" ? (
            <Card>
              <CardHeader>
                <StatusPill status="playing" />
                <CardTitle>対戦中です</CardTitle>
                <CardDescription>
                  対戦が終わったら、この画面から結果を進めます。誤操作を避けるため、結果操作は下の主ボタンだけにまとめています。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Table</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {getMatchLocationSummary(resolvedRuntime)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    対戦相手: {getOpponentLabel(resolvedRuntime)}
                  </p>
                </div>
                <div className="space-y-2 rounded-lg border p-4 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">固定ベット</span>
                    <span className="font-semibold text-foreground">
                      {formatBetAmount(resolvedRuntime.match?.agreedBetAmount ?? null)}
                    </span>
                  </div>
                </div>
                {!resolvedRuntime.match?.isStaffMatch ? (
                  <Button
                    type="button"
                    size="lg"
                    disabled={
                      !resolvedRuntime.currentMatchId ||
                      !resolvedRuntime.canClaimWin ||
                      pendingAction !== null
                    }
                    onClick={() =>
                      void runParticipantAction(
                        "claim-win",
                        postParticipantAction<ParticipantRuntimeState>("/api/match/claim-win", {
                          body: { matchId: resolvedRuntime.currentMatchId },
                          defaultErrorMessage:
                            "勝利申告に失敗しました。通信状況を確認してから、もう一度お試しください。",
                        }),
                      )
                    }
                    className="h-14 w-full"
                  >
                    {pendingAction === "claim-win"
                      ? "勝利申告を送信しています..."
                      : "勝利を申告する"}
                  </Button>
                ) : (
                  <Alert>
                    <AlertDescription>
                      運営戦の結果はスタッフが確定します。参加者側の勝利申告は不要です。
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ) : null}

          {resolvedRuntime.status === "claiming_win" ? (
            <Card>
              <CardHeader>
                <StatusPill status="claiming_win" />
                <CardTitle>勝利申告を送りました</CardTitle>
                <CardDescription>
                  相手の承認が届くまで、この画面のままお待ちください。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Waiting</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    相手の承認待ち
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {getMatchLocationSummary(resolvedRuntime)} / {getOpponentLabel(resolvedRuntime)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={!resolvedRuntime.currentMatchId || pendingAction !== null}
                  onClick={() =>
                    void runParticipantAction(
                      "cancel-claim",
                      postParticipantAction<ParticipantRuntimeState>("/api/match/cancel-claim", {
                        body: { matchId: resolvedRuntime.currentMatchId },
                        defaultErrorMessage:
                          "勝利申告の取り消しに失敗しました。少し待ってからもう一度お試しください。",
                      }),
                    )
                  }
                  className="h-14 w-full"
                >
                  {pendingAction === "cancel-claim"
                    ? "勝利申告を取り消しています..."
                    : "勝利申告を取り消す"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {resolvedRuntime.status === "awaiting_result_approval" ? (
            <Card>
              <CardHeader>
                <StatusPill status="awaiting_result_approval" />
                <CardTitle>相手の勝利申告を確認してください</CardTitle>
                <CardDescription>
                  誤タップを避けるため、承認と差し戻しを大きく分けています。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Claim</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {getOpponentLabel(resolvedRuntime)} さんが勝利申告中です
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {getMatchLocationSummary(resolvedRuntime)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="lg"
                  disabled={!resolvedRuntime.currentMatchId || pendingAction !== null}
                  onClick={() =>
                    void runParticipantAction(
                      "approve",
                      postParticipantAction<ParticipantRuntimeState>("/api/match/approve-result", {
                        body: { matchId: resolvedRuntime.currentMatchId, approve: true },
                        defaultErrorMessage:
                          "結果承認に失敗しました。通信状況を確認してからもう一度お試しください。",
                      }),
                    )
                  }
                  className="h-14 w-full"
                >
                  {pendingAction === "approve" ? "結果を承認しています..." : "承認する"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={!resolvedRuntime.currentMatchId || pendingAction !== null}
                  onClick={() =>
                    void runParticipantAction(
                      "reject",
                      postParticipantAction<ParticipantRuntimeState>("/api/match/approve-result", {
                        body: { matchId: resolvedRuntime.currentMatchId, approve: false },
                        defaultErrorMessage:
                          "承認しない処理に失敗しました。少し待ってからもう一度お試しください。",
                      }),
                    )
                  }
                  className="h-14 w-full"
                >
                  {pendingAction === "reject" ? "差し戻しています..." : "承認しない"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {resolvedRuntime.status === "result_confirmed" ? (
            <Card>
              <CardHeader>
                <StatusPill status="result_confirmed" />
                <CardTitle>結果が確定しました</CardTitle>
                <CardDescription>チップ更新を確認したら、次の案内へ進めます。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Chip update</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                    {formatResultDelta(resolvedRuntime.resultDelta)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">今回の増減</p>
                </div>
                <div className="space-y-2 rounded-lg border p-4 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">現在のチップ</span>
                    <span className="font-semibold text-foreground">
                      {resolvedRuntime.chipBalance}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">確定時刻</span>
                    <span className="font-semibold text-foreground">
                      {formatResultConfirmedAt(resolvedRuntime.resultConfirmedAt) ?? "確認中"}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  size="lg"
                  disabled={pendingAction !== null}
                  onClick={() =>
                    void runParticipantAction(
                      "ack",
                      postParticipantAction<ParticipantRuntimeState>(
                        "/api/participant/result/ack",
                        {
                          defaultErrorMessage:
                            "結果確認に失敗しました。通信状況を確認してから、もう一度お試しください。",
                        },
                      ),
                      () => router.push("/home"),
                    )
                  }
                  className="h-14 w-full"
                >
                  {pendingAction === "ack" ? "結果を確認しています..." : "結果を確認して次へ"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {resolvedRuntime.status === "disconnected" ? <ReconnectingOverlay /> : null}
        </div>
      ) : null}
    </main>
  );
}
