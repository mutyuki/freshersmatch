"use client";

import Link from "next/link";
import { useEffect, useState, type JSX } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useParticipantHeartbeat } from "@/hooks/useParticipantHeartbeat";
import { useParticipantRuntime } from "@/hooks/useParticipantRuntime";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";
import type { TableStatus } from "@/lib/domain/table-status";
import { getParticipantSessionToken } from "@/lib/session/participant-client-session";
import { participantStatusConfig } from "@/lib/ui/participant-status";
import { cn } from "@/lib/utils";

const STATUS_COPY: Record<ParticipantRuntimeState["status"], string> = {
  unregistered: "参加登録がまだ完了していません。登録内容を確認してから進んでください。",
  registered: "準備ができたら次のランダムマッチへ進めます。まずは情報を確認しましょう。",
  queueing: "現在は待機列に入っています。卓が決まり次第、このまま対戦案内へ切り替わります。",
  match_reserved:
    "対戦の案内が進んでいます。卓番号と相手情報を確認して、そのまま卓へ向かってください。",
  ready: "開始準備はできています。相手の準備完了を待って次へ進みます。",
  playing: "対戦中です。卓情報と進行中の案内を確認してください。",
  claiming_win: "勝利申告を送信済みです。相手の確認が終わるまでお待ちください。",
  awaiting_result_approval: "結果確認が届いています。対戦結果を確認して承認してください。",
  result_confirmed: "結果は確定済みです。チップ反映後、次のマッチへ進めます。",
  paused: "進行が一時停止されています。案内があるまでそのままお待ちください。",
  disqualified: "運営判断で参加停止中です。必要があれば近くのスタッフへ声をかけてください。",
  disconnected: "接続を復旧中です。復帰先の画面へ自動で戻ります。",
};

function getTableStatusLabel(status: TableStatus): string {
  switch (status) {
    case "available":
      return "案内可能";
    case "reserved":
      return "案内中";
    case "in_use":
      return "対戦中";
    case "admin_hold":
      return "使用停止中";
    default:
      return status;
  }
}

function getStartDisabledReason(runtime: ParticipantRuntimeState): string | null {
  if (runtime.canStartMatching) {
    return null;
  }

  if (runtime.chipBalance <= 0) {
    return "チップが 0 のため、次のマッチングを開始できません。";
  }

  return "現在の状態ではマッチング開始はできません。進行中の案内を確認してください。";
}

function StatusPill({ status }: { status: ParticipantRuntimeState["status"] }): JSX.Element {
  const config = participantStatusConfig[status];

  return (
    <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-xs", config.className)}>
      {config.label}
    </Badge>
  );
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

export default function HomePage(): JSX.Element {
  const router = useRouter();
  const { state, isLoading } = useParticipantRuntime();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useParticipantHeartbeat(!isLoading && Boolean(state));

  useEffect(() => {
    if (!isLoading && !state) {
      router.replace("/join");
    }
  }, [isLoading, router, state]);

  async function handleStartMatching(): Promise<void> {
    if (!state?.canStartMatching || isStarting) {
      return;
    }

    setIsStarting(true);
    setStartError(null);

    try {
      const sessionToken = getParticipantSessionToken();

      if (!sessionToken) {
        setStartError("参加セッションが見つかりません。もう一度参加登録を行ってください。");
        return;
      }

      const response = await fetch("/api/matching/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: {
          message?: string;
        };
      } | null;

      if (!response.ok) {
        setStartError(
          payload?.error?.message ??
            "マッチング開始に失敗しました。少し待ってからもう一度お試しください。",
        );
        return;
      }

      router.push("/match");
    } catch {
      setStartError("通信に失敗しました。電波状況を確認してからもう一度お試しください。");
    } finally {
      setIsStarting(false);
    }
  }

  const title = isLoading || !state ? "参加情報を確認しています..." : "次の一戦へ進む準備";

  return (
    <main className="flex min-h-full flex-col gap-4">
      <header className="space-y-3 px-1 pb-2 pt-4">
        <p className="inline-flex w-fit items-center rounded-full border px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Freshers Match
        </p>
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
            保存済みの参加情報を読み込み中です。画面をそのまま開いたままでお待ちください。
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !state ? (
        <Card>
          <CardContent className="pt-6 text-sm leading-6 text-muted-foreground">
            セッションが見つからないため、参加登録画面へ戻ります。
          </CardContent>
        </Card>
      ) : null}

      {state ? (
        <div className="space-y-4">
          {state.status === "paused" ? (
            <Card>
              <CardHeader>
                <StatusPill status="paused" />
                <CardTitle>進行が一時停止されています</CardTitle>
                <CardDescription>
                  運営により一時停止されています。運営に問い合わせてください。
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                スタッフの案内をお待ちください。対戦再開や次の操作は、運営側で状態が解除されるまで行えません。
              </CardContent>
            </Card>
          ) : null}

          {state.status === "disqualified" ? (
            <Card>
              <CardHeader>
                <StatusPill status="disqualified" />
                <CardTitle>失格となりました</CardTitle>
                <CardDescription>
                  この参加セッションでは、これ以上マッチングや対戦進行はできません。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive">
                  <AlertDescription>
                    {state.disqualifiedReason ??
                      "失格理由はまだ共有されていません。詳細は運営へお問い合わせください。"}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : null}

          {state.status !== "paused" && state.status !== "disqualified" ? (
            <>
              <Card>
                <CardHeader>
                  <StatusPill status={state.status} />
                  <CardTitle>{state.nickname} さんのホーム</CardTitle>
                  <CardDescription>{STATUS_COPY[state.status]}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium text-muted-foreground">Official Chips</p>
                    <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
                      {state.chipBalance.toLocaleString("ja-JP")}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      ランキング順位や次の対戦可否は、この正式チップ数で決まります。
                    </p>
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          現在の参加ステータス
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {STATUS_COPY[state.status]}
                        </p>
                      </div>
                      <StatusPill status={state.status} />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <p className="text-sm font-semibold text-foreground">卓情報</p>
                    {state.table ? (
                      <dl className="space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-muted-foreground">卓番号</dt>
                          <dd className="font-semibold text-foreground">
                            {state.table.tableNumber} 卓
                          </dd>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-muted-foreground">ゲーム</dt>
                          <dd className="font-semibold text-foreground">{state.table.gameTitle}</dd>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <dt className="text-muted-foreground">卓状態</dt>
                          <dd className="font-semibold text-foreground">
                            {getTableStatusLabel(state.table.status)}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-sm leading-6 text-muted-foreground">
                        まだ卓は割り当てられていません。準備ができたらマッチング開始を押すと、空いている卓へ順番に案内されます。
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Link href="/ranking">
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader>
                    <CardTitle>ランキングを見る</CardTitle>
                    <CardDescription>
                      現在順位を確認して、次の目標チップ数を見つけましょう。
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <section className="space-y-3">
                <Button
                  type="button"
                  size="lg"
                  disabled={!state.canStartMatching || isStarting}
                  onClick={handleStartMatching}
                  className="h-12 w-full"
                >
                  {isStarting ? "マッチングを開始しています..." : "マッチングを開始する"}
                </Button>

                <p className="text-sm leading-6 text-muted-foreground">
                  {getStartDisabledReason(state) ??
                    "待機列にはあとからでも戻れます。少し時間があるタイミングで始めて大丈夫です。"}
                </p>

                {startError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{startError}</AlertDescription>
                  </Alert>
                ) : null}
              </section>
            </>
          ) : null}

          {state.status === "disconnected" ? <ReconnectingOverlay /> : null}
        </div>
      ) : null}
    </main>
  );
}
