import type { JSX, ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ParticipantShell(props: { title: string; children: ReactNode }): JSX.Element {
  const { title, children } = props;

  return (
    <main className="flex min-h-full flex-col">
      <header className="px-1 pb-6 pt-4">
        <div className="inline-flex items-center rounded-full border border-stone-300/80 bg-white/75 px-3 py-1 text-[0.6875rem] font-semibold tracking-[0.22em] text-stone-600 uppercase shadow-sm backdrop-blur-sm">
          Freshers Match
        </div>
        <div className="mt-4 space-y-3">
          <p className="max-w-[28ch] text-sm leading-6 font-medium text-stone-600">
            いま必要な情報だけを、片手で迷わず操作できる並びで表示します。
          </p>
          <h1 className="max-w-[14ch] text-3xl leading-[1.08] font-semibold tracking-[-0.03em] text-stone-950">
            {title}
          </h1>
        </div>
      </header>

      <div className="flex-1 space-y-4">
        <Card
          className={cn(
            "relative overflow-visible rounded-[1.75rem] border border-stone-200/80 bg-white/92 shadow-[0_18px_50px_-28px_rgba(68,40,18,0.35)] ring-1 ring-white/70 backdrop-blur-sm",
            "before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-stone-300/70 before:to-transparent before:content-['']",
          )}
        >
          <CardContent className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
