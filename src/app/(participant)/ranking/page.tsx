"use client";

import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { useRouter } from "next/navigation";

import { ParticipantShell } from "@/components/participant/participant-shell";
import { RankingList } from "@/components/ranking/ranking-list";
import { useRankingRealtime } from "@/hooks/useRankingRealtime";
import type { RankingSnapshot } from "@/lib/contracts/ranking";
import { useParticipantRuntime } from "@/hooks/useParticipantRuntime";

type RankingResponse = {
  data?: RankingSnapshot;
  error?: {
    message?: string;
  };
};

export default function ParticipantRankingPage(): JSX.Element {
  const router = useRouter();
  const { state, isLoading } = useParticipantRuntime();
  const [entries, setEntries] = useState<RankingSnapshot["entries"]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
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
      const response = await fetch("/api/ranking", {
        method: "GET",
      });
      const payload = (await response.json().catch(() => null)) as RankingResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ??
            "ランキングの読み込みに失敗しました。少し待ってからもう一度お試しください。",
        );
      }

      if (isMountedRef.current) {
        setEntries(payload.data.entries);
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

  if (isLoading) {
    return (
      <ParticipantShell title="順位表を確認しています...">
        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 px-4 py-4 text-sm leading-6 text-stone-700">
          保存済みの参加情報を読み込み中です。画面をそのまま開いたままでお待ちください。
        </div>
      </ParticipantShell>
    );
  }

  if (!state) {
    return (
      <ParticipantShell title="順位表を確認しています...">
        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 px-4 py-4 text-sm leading-6 text-stone-700">
          セッションが見つからないため、参加登録画面へ戻ります。
        </div>
      </ParticipantShell>
    );
  }

  return (
    <ParticipantShell title="いまの順位を見つける" heartbeatEnabled={true}>
      <div className="space-y-5">
        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 px-4 py-4 text-sm leading-6 text-stone-700">
          自分の行を目で追いやすいように強調表示しています。現在の所持チップと順位を確認して、次の一戦の目標を決めましょう。
        </div>

        {isRankingLoading ? (
          <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 px-4 py-5 text-sm leading-6 text-stone-700">
            最新のランキングを読み込んでいます...
          </div>
        ) : null}

        {rankingError ? (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-800">
            {rankingError}
          </div>
        ) : null}

        {!isRankingLoading && !rankingError && entries.length === 0 ? (
          <div className="rounded-[1.5rem] border border-stone-200 bg-white/80 px-4 py-5 text-sm leading-6 text-stone-700">
            まだランキング対象の参加者がいません。参加者がそろうとここに順位が表示されます。
          </div>
        ) : null}

        {!isRankingLoading && !rankingError && entries.length > 0 ? (
          <RankingList entries={entries} highlightParticipantId={state.participantId} />
        ) : null}
      </div>
    </ParticipantShell>
  );
}
