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

import { getParticipantSessionToken } from "@/lib/session/participant-client-session";
import { participantStatusConfig } from "@/lib/ui/participant-status";
import { cn } from "@/lib/utils";

const STATUS_COPY: Record<ParticipantRuntimeState["status"], string> = {
  unregistered: "参加登録がまだ完了していません。登録内容を確認してから進んでください。",
  registered: "",
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
  const [isHydrated, setIsHydrated] = useState(process.env.NODE_ENV === "test");
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated) {
      setIsHydrated(true);
    }
  }, [isHydrated]);

  useParticipantHeartbeat(isHydrated && !isLoading && Boolean(state));

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isLoading && !state) {
      router.replace("/join");
    }
  }, [isHydrated, isLoading, router, state]);

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

  return (
    <main className="flex min-h-full flex-col gap-4 pb-4">
      {!isHydrated || isLoading ? (
        <Card>
          <CardContent className="pt-6 text-sm leading-6 text-muted-foreground">
            保存済みの参加情報を読み込み中です。画面をそのまま開いたままでお待ちください。
          </CardContent>
        </Card>
      ) : null}

      {isHydrated && !isLoading && !state ? (
        <Card>
          <CardContent className="pt-6 text-sm leading-6 text-muted-foreground">
            セッションが見つからないため、参加登録画面へ戻ります。
          </CardContent>
        </Card>
      ) : null}

      {isHydrated && state ? (
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
              <Card className="border-foreground/10 shadow-sm">
                <CardHeader>
                  <StatusPill status={state.status} />
                  <CardTitle>{state.nickname} さんのホーム</CardTitle>
                  {STATUS_COPY[state.status] ? <CardDescription>{STATUS_COPY[state.status]}</CardDescription> : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-foreground/10 bg-muted/25 p-4">
                    <p className="text-sm font-medium text-muted-foreground">Official Chips</p>
                    <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
                      {state.chipBalance.toLocaleString("ja-JP")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <section className="space-y-3">
                <Button
                  type="button"
                  size="lg"
                  disabled={!state.canStartMatching || isStarting}
                  onClick={handleStartMatching}
                  className="h-14 w-full text-base font-semibold"
                >
                  {isStarting ? "マッチングを開始しています..." : "マッチングを開始する"}
                </Button>

                {getStartDisabledReason(state) ? (
                  <p className="text-sm leading-6 text-muted-foreground">{getStartDisabledReason(state)}</p>
                ) : null}

                {startError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{startError}</AlertDescription>
                  </Alert>
                ) : null}
              </section>

              <Link href="/ranking">
                <Card className="border-foreground/10 transition-colors hover:bg-accent/60">
                  <CardHeader>
                    <CardTitle>ランキングを見る</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            </>
          ) : null}

          {state.status === "disconnected" ? <ReconnectingOverlay /> : null}
        </div>
      ) : null}
    </main>
  );
}
