import type { JSX, ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { cn } from "@/lib/utils";

export function AdminShell(props: {
  title?: string;
  description?: string;
  children: ReactNode;
}): JSX.Element {
  const {
    title = "Admin Console",
    description = "会場の状況確認とトラブル対応を、一覧性を落とさず操作できる共通レイアウトです。",
    children,
  } = props;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1e293b_0%,#0f172a_36%,#020617_100%)] px-6 py-6 text-white lg:px-10 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col">
        <header className="rounded-[2rem] border border-white/10 bg-white/[0.045] px-7 py-7 shadow-[0_24px_80px_-46px_rgba(15,23,42,0.9)] ring-1 ring-white/8 backdrop-blur-md">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1.5 text-sm font-semibold tracking-[0.24em] text-cyan-100 uppercase">
                  Freshers Match Admin
                </div>
                <div className="space-y-3">
                  <h1 className="text-4xl leading-none font-semibold tracking-[-0.05em] text-white lg:text-[3.25rem]">
                    {title}
                  </h1>
                  <p className="max-w-3xl text-base leading-7 text-slate-300 lg:text-lg">
                    {description}
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  "rounded-[1.6rem] border border-white/10 bg-slate-950/35 px-5 py-4 text-sm text-slate-300",
                  "shadow-[0_18px_40px_-30px_rgba(15,23,42,0.8)]",
                )}
              >
                各画面はこの共通骨組みの上に一覧・操作パネルを積み上げる前提です。
              </div>
            </div>

            <AdminNav />
          </div>
        </header>

        <main className="flex-1 py-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
