"use client";

import type { JSX } from "react";

import { StatusBadge } from "@/components/participant/status-badge";
import { Card, CardContent } from "@/components/ui/card";

export function PausedPanel(): JSX.Element {
  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <StatusBadge status="paused" />
        <div className="space-y-2">
          <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
            TEMPORARILY PAUSED
          </p>
          <h2 className="text-2xl leading-tight font-semibold tracking-[-0.03em] text-stone-950">
            進行が一時停止されています
          </h2>
          <p className="text-sm leading-6 text-stone-700">
            運営により一時停止されています。運営に問い合わせてください。
          </p>
        </div>
      </section>

      <Card className="rounded-[1.5rem] border border-amber-200/80 bg-linear-to-br from-amber-50 via-orange-50 to-white py-0 shadow-[0_18px_40px_-30px_rgba(180,97,36,0.42)] ring-1 ring-amber-100/80">
        <CardContent className="space-y-3 px-5 py-5">
          <div className="rounded-[1.25rem] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
            <p className="text-sm font-semibold text-stone-950">スタッフの案内をお待ちください</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              対戦再開や次の操作は、運営側で状態が解除されるまで行えません。画面はそのまま開いたままで大丈夫です。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
