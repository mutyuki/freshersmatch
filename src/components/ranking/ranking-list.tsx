import type { JSX } from "react";

import type { RankingEntry } from "@/lib/contracts/ranking";
import { cn } from "@/lib/utils";

function getStatusLabel(status: RankingEntry["status"]): string | null {
  if (status === "disqualified") {
    return "失格";
  }

  return null;
}

export function RankingList(props: {
  entries: RankingEntry[];
  highlightParticipantId?: string;
}): JSX.Element {
  const { entries, highlightParticipantId } = props;
  const isParticipantMode = Boolean(highlightParticipantId);

  if (isParticipantMode) {
    return (
      <div className="space-y-3">
        {entries.map((entry) => {
          const isHighlighted = entry.participantId === highlightParticipantId;
          const statusLabel = getStatusLabel(entry.status);

          return (
            <article
              key={entry.participantId}
              aria-current={isHighlighted ? "true" : undefined}
              className={cn(
                "rounded-[1.4rem] border px-4 py-4 shadow-sm transition-colors",
                isHighlighted
                  ? "border-amber-300 bg-linear-to-r from-amber-100 via-orange-50 to-white ring-2 ring-amber-200/80"
                  : "border-stone-200/80 bg-white/90",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold",
                        isHighlighted
                          ? "bg-stone-950 text-stone-50"
                          : "bg-stone-100 text-stone-700",
                      )}
                    >
                      {entry.rank}
                    </span>
                    {isHighlighted ? (
                      <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-950">
                        YOU
                      </span>
                    ) : null}
                    {statusLabel ? (
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">
                        {statusLabel}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-base text-stone-950",
                        isHighlighted ? "font-bold" : "font-semibold",
                      )}
                    >
                      {entry.nickname}
                    </p>
                    <p className="mt-1 text-xs tracking-[0.22em] text-stone-500 uppercase">
                      Official chips
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "text-2xl leading-none tracking-[-0.04em] text-stone-950",
                      isHighlighted ? "font-bold" : "font-semibold",
                    )}
                  >
                    {entry.chipBalance.toLocaleString("ja-JP")}
                  </p>
                  <p className="mt-2 text-xs text-stone-500">chips</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/15 bg-black/20 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.8)] backdrop-blur-sm">
      <table className="w-full table-fixed border-collapse">
        <thead className="bg-white/8">
          <tr className="border-b border-white/10">
            <th className="w-24 px-6 py-4 text-left text-sm font-semibold tracking-[0.22em] text-white/65 uppercase">
              Rank
            </th>
            <th className="px-4 py-4 text-left text-sm font-semibold tracking-[0.22em] text-white/65 uppercase">
              Name
            </th>
            <th className="w-40 px-6 py-4 text-right text-sm font-semibold tracking-[0.22em] text-white/65 uppercase">
              Chips
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const statusLabel = getStatusLabel(entry.status);

            return (
              <tr
                key={entry.participantId}
                className={cn(
                  "border-b border-white/8 text-white",
                  index % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent",
                )}
              >
                <td className="px-6 py-4 align-middle text-2xl font-semibold tracking-[-0.03em]">
                  {entry.rank}
                </td>
                <td className="px-4 py-4 align-middle">
                  <div className="flex items-center gap-3">
                    <span className="truncate text-2xl font-medium">{entry.nickname}</span>
                    {statusLabel ? (
                      <span className="shrink-0 rounded-full bg-rose-500/18 px-3 py-1 text-sm font-semibold text-rose-100">
                        {statusLabel}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-6 py-4 text-right align-middle text-2xl font-semibold tracking-[-0.03em]">
                  {entry.chipBalance.toLocaleString("ja-JP")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
