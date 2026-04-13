import type { ParticipantStatus } from "@/lib/domain/participant-status";

export const participantStatusConfig: Record<
  ParticipantStatus,
  {
    label: string;
    className: string;
  }
> = {
  unregistered: {
    label: "未登録",
    className: "border-stone-300 bg-stone-100 text-stone-700",
  },
  registered: {
    label: "参加登録済み",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  queueing: {
    label: "マッチ待機中",
    className: "border-orange-200 bg-orange-50 text-orange-900",
  },
  match_reserved: {
    label: "対戦案内中",
    className: "border-lime-200 bg-lime-50 text-lime-900",
  },
  ready: {
    label: "開始準備OK",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  playing: {
    label: "対戦中",
    className: "border-sky-200 bg-sky-100 text-sky-950",
  },
  claiming_win: {
    label: "勝利申告済み",
    className: "border-violet-200 bg-violet-100 text-violet-950",
  },
  awaiting_result_approval: {
    label: "結果承認待ち",
    className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950",
  },
  result_confirmed: {
    label: "結果確定",
    className: "border-teal-200 bg-teal-50 text-teal-950",
  },
  paused: {
    label: "一時停止中",
    className: "border-amber-300 bg-amber-100 text-amber-950",
  },
  disqualified: {
    label: "失格",
    className: "border-red-300 bg-red-100 text-red-950",
  },
  disconnected: {
    label: "再接続待ち",
    className: "border-slate-300 bg-slate-200 text-slate-900",
  },
};
