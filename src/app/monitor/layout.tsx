import type { JSX, ReactNode } from "react";

export default function MonitorLayout(props: Readonly<{ children: ReactNode }>): JSX.Element {
  const { children } = props;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#334155_0%,#111827_42%,#020617_100%)] px-6 py-6 text-white lg:px-10 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div className="space-y-3">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-sm font-semibold tracking-[0.24em] text-white/70 uppercase">
              Freshers Match Monitor
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl leading-none font-semibold tracking-[-0.04em] text-white lg:text-5xl">
                Ranking Board
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-300 lg:text-lg">
                現在の公式チップ所持数ランキングです。会場全体から見やすい一覧表示で更新内容を確認できます。
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 py-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
