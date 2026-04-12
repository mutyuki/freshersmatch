"use client";

import { useEffect, useState, type JSX } from "react";
import { useRouter } from "next/navigation";

import { ClaimWaitPanel } from "@/components/participant/claim-wait-panel";
import { InProgressPanel } from "@/components/participant/in-progress-panel";
import { MatchReservedPanel } from "@/components/participant/match-reserved-panel";
import { ParticipantShell } from "@/components/participant/participant-shell";
import { QueuePanel } from "@/components/participant/queue-panel";
import { ReconnectingOverlay } from "@/components/participant/reconnecting-overlay";
import { ResultApprovalPanel } from "@/components/participant/result-approval-panel";
import { ResultConfirmedPanel } from "@/components/participant/result-confirmed-panel";
import { useParticipantRuntime } from "@/hooks/useParticipantRuntime";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";
import { PARTICIPANT_RUNTIME_UPDATED_EVENT } from "@/lib/participant-runtime-events";

export default function MatchPage(): JSX.Element {
  const router = useRouter();
  const { state, isLoading } = useParticipantRuntime();
  const [runtime, setRuntime] = useState<ParticipantRuntimeState | null>(state);
  const resolvedRuntime = runtime ?? state;

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
    if (!isLoading && !resolvedRuntime) {
      router.replace("/join");
    }
  }, [isLoading, resolvedRuntime, router]);

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

  if (!resolvedRuntime) {
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
      {resolvedRuntime.status === "queueing" ? <QueuePanel runtime={resolvedRuntime} /> : null}
      {resolvedRuntime.status === "match_reserved" || resolvedRuntime.status === "ready" ? (
        <MatchReservedPanel runtime={resolvedRuntime} />
      ) : null}
      {resolvedRuntime.status === "playing" ? <InProgressPanel runtime={resolvedRuntime} /> : null}
      {resolvedRuntime.status === "claiming_win" ? <ClaimWaitPanel runtime={resolvedRuntime} /> : null}
      {resolvedRuntime.status === "awaiting_result_approval" ? (
        <ResultApprovalPanel runtime={resolvedRuntime} />
      ) : null}
      {resolvedRuntime.status === "result_confirmed" ? (
        <ResultConfirmedPanel runtime={resolvedRuntime} />
      ) : null}
      {resolvedRuntime.status === "disconnected" ? <ReconnectingOverlay /> : null}
    </ParticipantShell>
  );
}
