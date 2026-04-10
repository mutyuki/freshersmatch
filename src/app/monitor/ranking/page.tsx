"use client";

import { useEffect, useState, type JSX } from "react";

import { RankingList } from "@/components/ranking/ranking-list";
import type { RankingEntry } from "@/lib/contracts/ranking";

type RankingResponse = {
  data?: RankingEntry[];
  error?: {
    message?: string;
  };
};

export default function MonitorRankingPage(): JSX.Element {
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadRanking(): Promise<void> {
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

        if (!isCancelled) {
          setEntries(payload.data);
        }
      } catch (nextError) {
        if (!isCancelled) {
          setEntries([]);
          setError(
            nextError instanceof Error
              ? nextError.message
              : "ランキングを読み込めませんでした。しばらくして再表示してください。",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadRanking();

    return () => {
      isCancelled = true;
    };
  }, []);

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
