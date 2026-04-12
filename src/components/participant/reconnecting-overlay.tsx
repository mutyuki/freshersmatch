"use client";

import type { JSX } from "react";

export function ReconnectingOverlay(): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-6 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-[1.75rem] border border-white/70 bg-white/96 px-6 py-6 text-center shadow-[0_24px_60px_-30px_rgba(28,25,23,0.6)] ring-1 ring-white/80">
        <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
          RECONNECTING
        </p>
        <h2 className="mt-3 text-2xl leading-tight font-semibold tracking-[-0.03em] text-stone-950">
          再接続中...
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          接続を復旧しています。復帰先の画面へ自動で戻るまで、このままお待ちください。
        </p>
      </div>
    </div>
  );
}
