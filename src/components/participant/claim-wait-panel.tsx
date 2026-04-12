import type { JSX } from "react";

import { StatusBadge } from "@/components/participant/status-badge";
import {
  getMatchLocationSummary,
  getOpponentLabel,
} from "@/components/participant/match-panel-utils";
import { Card, CardContent } from "@/components/ui/card";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";

export function ClaimWaitPanel(props: { runtime: ParticipantRuntimeState }): JSX.Element {
  const { runtime } = props;

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <StatusBadge status="claiming_win" />
        <div className="space-y-2">
          <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
            CLAIM SENT
          </p>
          <h2 className="text-2xl leading-tight font-semibold tracking-[-0.03em] text-stone-950">
            勝利申告を送りました
          </h2>
          <p className="text-sm leading-6 text-stone-700">
            相手の承認が届くまで、この画面のままお待ちください。結果が戻された場合は自動で対戦中表示へ戻ります。
          </p>
        </div>
      </section>

      <Card className="rounded-[1.5rem] border border-violet-200/80 bg-linear-to-br from-violet-50 via-fuchsia-50 to-white py-0 shadow-[0_18px_40px_-30px_rgba(124,58,237,0.32)] ring-1 ring-violet-100/70">
        <CardContent className="space-y-4 px-5 py-5">
          <div className="rounded-[1.25rem] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
            <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-violet-700 uppercase">
              Waiting
            </p>
            <p className="mt-2 text-2xl leading-tight font-semibold tracking-[-0.04em] text-stone-950">
              相手の承認待ち
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {getMatchLocationSummary(runtime)} / {getOpponentLabel(runtime)}
            </p>
          </div>

          <div className="rounded-[1.25rem] border border-dashed border-violet-200 bg-white/70 px-4 py-4 text-sm leading-6 text-stone-700">
            承認されると結果確定画面へ進みます。承認されない場合は対戦中へ戻るので、画面を閉じずにそのまま待機してください。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
