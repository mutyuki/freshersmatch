"use client";

import { useEffect, type JSX } from "react";
import { useRouter } from "next/navigation";

import { MatchReservedPanel } from "@/components/participant/match-reserved-panel";
import { ParticipantShell } from "@/components/participant/participant-shell";
import { QueuePanel } from "@/components/participant/queue-panel";
import { useParticipantRuntime } from "@/hooks/useParticipantRuntime";

export default function MatchPage(): JSX.Element {
  const router = useRouter();
  const { state, isLoading } = useParticipantRuntime();

  useEffect(() => {
    if (!isLoading && !state) {
      router.replace("/join");
    }
  }, [isLoading, router, state]);

  if (isLoading) {
    return (
      <ParticipantShell title="対戦案内を確認しています...">
        <div className="space-y-4 text-sm leading-6 text-stone-700">
          <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 px-4 py-4">
            保存済みの参加情報を読み込み中です。待機状況や卓案内があれば、この画面にすぐ反映します。
          </div>
        </div>
      </ParticipantShell>
    );
  }

  if (!state) {
    return (
      <ParticipantShell title="対戦案内を確認しています...">
        <div className="space-y-4 text-sm leading-6 text-stone-700">
          <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 px-4 py-4">
            セッションが見つからないため、参加登録画面へ戻ります。
          </div>
        </div>
      </ParticipantShell>
    );
  }

  return (
    <ParticipantShell title="次の卓案内を確認する" heartbeatEnabled={true}>
      {state.status === "queueing" ? <QueuePanel runtime={state} /> : null}
      {state.status === "match_reserved" || state.status === "ready" ? (
        <MatchReservedPanel runtime={state} />
      ) : null}
    </ParticipantShell>
  );
}
