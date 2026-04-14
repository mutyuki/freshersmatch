"use client";

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useParticipantHeartbeat } from "@/hooks/useParticipantHeartbeat";
import { useParticipantRuntime } from "@/hooks/useParticipantRuntime";
import { useRankingRealtime } from "@/hooks/useRankingRealtime";
import type { RankingEntry, RankingSnapshot } from "@/lib/contracts/ranking";
import { loadRankingSnapshot } from "@/lib/ranking/load-ranking-snapshot";
import { cn } from "@/lib/utils";

function getStatusLabel(status: RankingEntry["status"]): string | null {
  return status === "disqualified" ? "失格" : null;
}

function ParticipantRankingList(props: {
  entries: RankingEntry[];
  highlightParticipantId: string;
}): JSX.Element {
  return (
    <div className="space-y-3">
      {props.entries.map((entry) => {
        const isHighlighted = entry.participantId === props.highlightParticipantId;
        const statusLabel = getStatusLabel(entry.status);

        return (
          <article
            key={entry.participantId}
            aria-current={isHighlighted ? "true" : undefined}
            className={cn("rounded-xl border bg-card p-4", isHighlighted && "border-primary")}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isHighlighted ? "default" : "secondary"}>{entry.rank}</Badge>
                  {isHighlighted ? <Badge>YOU</Badge> : null}
                  {statusLabel ? <Badge variant="destructive">{statusLabel}</Badge> : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">
                    {entry.nickname}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    Official chips
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {entry.chipBalance.toLocaleString("ja-JP")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">chips</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function ParticipantRankingPage(): JSX.Element {
  const router = useRouter();
  const { state, isLoading } = useParticipantRuntime();
  const [entries, setEntries] = useState<RankingSnapshot["entries"]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useParticipantHeartbeat(!isLoading && Boolean(state));

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !state) {
      router.replace("/join");
    }
  }, [isLoading, router, state]);

  const loadRanking = useCallback(async (): Promise<void> => {
    setIsRankingLoading(true);
    setRankingError(null);

    try {
      const snapshot = await loadRankingSnapshot(
        "ランキングの読み込みに失敗しました。少し待ってからもう一度お試しください。",
        "ランキングの取得に時間がかかっています。通信状況を確認して、もう一度開き直してください。",
      );

      if (isMountedRef.current) {
        setEntries(snapshot.entries);
      }
    } catch (error) {
      if (isMountedRef.current) {
        setEntries([]);
        setRankingError(
          error instanceof Error
            ? error.message
            : "ランキングの読み込みに失敗しました。少し待ってからもう一度お試しください。",
        );
      }
    } finally {
      if (isMountedRef.current) {
        setIsRankingLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }

    void loadRanking();
  }, [loadRanking, state]);

  useRankingRealtime({
    enabled: !!state,
    eventId: state?.eventId ?? "",
    refresh: loadRanking,
  });

  return (
    <main className="flex min-h-full flex-col gap-4">
      <header className="space-y-2 px-1 pb-2 pt-1">
        <div className="space-y-2">
          <p className="text-sm leading-6 text-muted-foreground">
            自分の行を目で追いやすいように強調表示しています。現在の所持チップと順位を確認して、次の一戦の目標を決めましょう。
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {isLoading || !state ? "順位表を確認しています..." : "いまの順位を見つける"}
          </h1>
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
        <>
          {isRankingLoading ? (
            <Card>
              <CardContent className="pt-6 text-sm leading-6 text-muted-foreground">
                最新のランキングを読み込んでいます...
              </CardContent>
            </Card>
          ) : null}

          {rankingError ? (
            <Alert variant="destructive">
              <AlertDescription>{rankingError}</AlertDescription>
            </Alert>
          ) : null}

          {!isRankingLoading && !rankingError && entries.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-sm leading-6 text-muted-foreground">
                まだランキング対象の参加者がいません。参加者がそろうとここに順位が表示されます。
              </CardContent>
            </Card>
          ) : null}

          {!isRankingLoading && !rankingError && entries.length > 0 ? (
            <ParticipantRankingList
              entries={entries}
              highlightParticipantId={state.participantId}
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
}
