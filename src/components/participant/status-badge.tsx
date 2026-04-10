import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { ParticipantStatus } from "@/lib/domain/participant-status";
import { cn } from "@/lib/utils";

const STATUS_BADGE_STYLES = {
  unregistered: {
    label: "未登録",
    className: "border-stone-300/90 bg-stone-100 text-stone-700 shadow-sm shadow-stone-200/50",
  },
  registered: {
    label: "参加登録済み",
    className: "border-amber-200/90 bg-amber-50 text-amber-900 shadow-sm shadow-amber-100/70",
  },
  queueing: {
    label: "マッチ待機中",
    className: "border-orange-200/90 bg-orange-50 text-orange-900 shadow-sm shadow-orange-100/70",
  },
  match_reserved: {
    label: "対戦案内中",
    className: "border-lime-200/90 bg-lime-50 text-lime-900 shadow-sm shadow-lime-100/70",
  },
  ready: {
    label: "開始準備OK",
    className:
      "border-emerald-200/90 bg-emerald-50 text-emerald-900 shadow-sm shadow-emerald-100/70",
  },
  playing: {
    label: "対戦中",
    className: "border-sky-200/90 bg-sky-100 text-sky-950 shadow-sm shadow-sky-200/70",
  },
  claiming_win: {
    label: "勝利申告済み",
    className: "border-violet-200/90 bg-violet-100 text-violet-950 shadow-sm shadow-violet-200/70",
  },
  awaiting_result_approval: {
    label: "結果承認待ち",
    className:
      "border-fuchsia-200/90 bg-fuchsia-50 text-fuchsia-950 shadow-sm shadow-fuchsia-100/70",
  },
  result_confirmed: {
    label: "結果確定",
    className: "border-teal-200/90 bg-teal-50 text-teal-950 shadow-sm shadow-teal-100/70",
  },
  paused: {
    label: "一時停止中",
    className: "border-amber-300/90 bg-amber-100 text-amber-950 shadow-sm shadow-amber-200/70",
  },
  disqualified: {
    label: "失格",
    className: "border-red-300/90 bg-red-100 text-red-950 shadow-sm shadow-red-200/70",
  },
  disconnected: {
    label: "再接続待ち",
    className: "border-slate-300/90 bg-slate-200 text-slate-900 shadow-sm shadow-slate-300/60",
  },
} satisfies Record<
  ParticipantStatus,
  {
    label: string;
    className: string;
  }
>;

export function StatusBadge({ status }: { status: ParticipantStatus }): JSX.Element {
  const config = STATUS_BADGE_STYLES[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-7 rounded-full px-3 text-[0.6875rem] font-semibold tracking-[0.14em] uppercase",
        config.className,
      )}
    >
      {config.label}
    </Badge>
  );
}
