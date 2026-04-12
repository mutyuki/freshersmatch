"use client";

import { useCallback, useEffect, useState, type JSX } from "react";

import { RankingList } from "@/components/ranking/ranking-list";
import { useRankingRealtime } from "@/hooks/useRankingRealtime";
import type { RankingSnapshot } from "@/lib/contracts/ranking";

type RankingResponse = {
  data?: RankingSnapshot;
  error?: {
    message?: string;
  };
};

export default function MonitorRankingPage(): JSX.Element {
  const [entries, setEntries] = useState<RankingSnapshot["entries"]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRanking = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ranking", {
        method: "GET",
      });
      const payload = (await response.json().catch(() => null)) as RankingResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ??
            "ランキングを読み込めませんでした。しばらくして再表示してください。",
        );
      }

      setEntries(payload.data.entries);
      setEventId(payload.data.eventId);
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

  return <RankingList entries={entries} />;
}
