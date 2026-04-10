import type { JSX } from "react";

import { JoinForm } from "@/components/participant/join-form";
import { ParticipantShell } from "@/components/participant/participant-shell";

export default function JoinPage(): JSX.Element {
  return (
    <ParticipantShell title="会場コードを入れて参加する" heartbeatEnabled={false}>
      <div className="space-y-5">
        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 px-4 py-4 text-sm leading-6 text-stone-700">
          はじめての対戦前に、会場コードとニックネームを登録します。入力後すぐにホームへ進みます。
        </div>
        <JoinForm />
      </div>
    </ParticipantShell>
  );
}
