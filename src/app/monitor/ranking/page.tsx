"use client";

import { useCallback, useEffect, useState, type JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useRankingRealtime } from "@/hooks/useRankingRealtime";
import type { RankingSnapshot } from "@/lib/contracts/ranking";
import { loadRankingSnapshot } from "@/lib/ranking/load-ranking-snapshot";
import { cn } from "@/lib/utils";

function getStatusLabel(status: RankingSnapshot["entries"][number]["status"]): string | null {
  return status === "disqualified" ? "失格" : null;
}

export default function MonitorRankingPage(): JSX.Element {
  const [entries, setEntries] = useState<RankingSnapshot["entries"]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRanking = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await loadRankingSnapshot(
        "ランキングを読み込めませんでした。しばらくして再表示してください。",
        "ランキングの取得に時間がかかっています。通信状況を確認して、再表示してください。",
      );

      setEntries(snapshot.entries);
      setEventId(snapshot.eventId);
    } catch (nextError) {
      setEntries([]);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "ランキングを読み込めませんでした。しばらくして再表示してください。",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRanking();
  }, [loadRanking]);

  useRankingRealtime({
    enabled: !!eventId,
    eventId: eventId ?? "",
    refresh: loadRanking,
  });

  if (isLoading) {
    return (
      <div className="rounded-[1.75rem] border border-white/12 bg-white/8 px-8 py-10 text-2xl font-medium text-white/88">
        ランキングを読み込んでいます...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[1.75rem] border border-rose-400/30 bg-rose-500/10 px-8 py-10 text-2xl font-medium text-rose-100">
        {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-white/12 bg-white/8 px-8 py-10 text-2xl font-medium text-white/88">
        まだランキング対象の参加者がいません。
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Rank</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-40 text-right">Chips</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, index) => {
              const statusLabel = getStatusLabel(entry.status);

              return (
                <TableRow key={entry.participantId} className={cn(index % 2 === 0 && "bg-muted/20")}>
                  <TableCell className="text-2xl font-semibold">{entry.rank}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="truncate text-2xl font-medium">{entry.nickname}</span>
                      {statusLabel ? <Badge variant="destructive">{statusLabel}</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-2xl font-semibold">
                    {entry.chipBalance.toLocaleString("ja-JP")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
