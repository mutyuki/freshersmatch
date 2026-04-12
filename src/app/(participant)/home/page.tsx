"use client";

import { useEffect, type JSX } from "react";
import { useRouter } from "next/navigation";

import { DisqualifiedPanel } from "@/components/participant/disqualified-panel";
import { HomePanel } from "@/components/participant/home-panel";
import { PausedPanel } from "@/components/participant/paused-panel";
import { ParticipantShell } from "@/components/participant/participant-shell";
import { ReconnectingOverlay } from "@/components/participant/reconnecting-overlay";
import { useParticipantRuntime } from "@/hooks/useParticipantRuntime";

export default function HomePage(): JSX.Element {
  const router = useRouter();
  const { state, isLoading } = useParticipantRuntime();

  useEffect(() => {
    if (!isLoading && !state) {
      router.replace("/join");
    }
  }, [isLoading, router, state]);

  if (isLoading) {
    return (
      <ParticipantShell title="参加情報を確認しています...">
        <div className="space-y-4 text-sm leading-6 text-stone-700">
          <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 px-4 py-4">
            保存済みの参加情報を読み込み中です。画面をそのまま開いたままでお待ちください。
          </div>
        </div>
      </ParticipantShell>
    );
  }

  if (!state) {
    return (
      <ParticipantShell title="参加情報を確認しています...">
        <div className="space-y-4 text-sm leading-6 text-stone-700">
          <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 px-4 py-4">
            セッションが見つからないため、参加登録画面へ戻ります。
          </div>
        </div>
      </ParticipantShell>
    );
  }

  return (
    <ParticipantShell title="次の一戦へ進む準備" heartbeatEnabled={true}>
      {state.status === "paused" ? <PausedPanel /> : null}
      {state.status === "disqualified" ? (
        <DisqualifiedPanel reason={state.disqualifiedReason} />
      ) : null}
      {state.status !== "paused" && state.status !== "disqualified" ? (
        <HomePanel runtime={state} />
      ) : null}
      {state.status === "disconnected" ? <ReconnectingOverlay /> : null}
    </ParticipantShell>
  );
}
