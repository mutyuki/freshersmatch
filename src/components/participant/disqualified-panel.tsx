"use client";

import type { JSX } from "react";

import { StatusBadge } from "@/components/participant/status-badge";
import { Card, CardContent } from "@/components/ui/card";

export function DisqualifiedPanel(props: { reason: string | null }): JSX.Element {
  const { reason } = props;

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <StatusBadge status="disqualified" />
        <div className="space-y-2">
          <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
            DISQUALIFIED
          </p>
          <h2 className="text-2xl leading-tight font-semibold tracking-[-0.03em] text-stone-950">
            失格となりました
          </h2>
          <p className="text-sm leading-6 text-stone-700">
            この参加セッションでは、これ以上マッチングや対戦進行はできません。必要があれば近くのスタッフへお声がけください。
          </p>
        </div>
      </section>

      <Card className="rounded-[1.5rem] border border-red-200/80 bg-linear-to-br from-red-50 via-rose-50 to-white py-0 shadow-[0_18px_40px_-30px_rgba(185,28,28,0.35)] ring-1 ring-red-100/80">
        <CardContent className="space-y-3 px-5 py-5">
          <div className="rounded-[1.25rem] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
            <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-red-700 uppercase">
              Reason
            </p>
            <p className="mt-2 text-sm leading-6 font-medium text-stone-950">
              {reason ?? "失格理由はまだ共有されていません。詳細は運営へお問い合わせください。"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
