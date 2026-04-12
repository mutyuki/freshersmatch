"use client";

import type { JSX } from "react";

import { StatusBadge } from "@/components/participant/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";

function getOpponentLabel(runtime: ParticipantRuntimeState): string {
  if (runtime.match?.isStaffMatch) {
    return "運営スタッフ";
  }

  return runtime.opponent?.nickname ?? "確認中";
}

export function MatchReservedPanel(props: { runtime: ParticipantRuntimeState }): JSX.Element {
  const { runtime } = props;
  const isReadyState = runtime.status === "ready";
  const hasTable = runtime.table !== null;
  const opponentLabel = getOpponentLabel(runtime);
  const primaryLabel = isReadyState
    ? "相手の到着を待っています"
    : "開始導線は次タスクで接続予定です";
  const helperCopy = isReadyState
    ? "あなたの準備は完了しています。相手の準備がそろうと対戦開始へ進みます。"
    : "卓に着いたらすぐ始められるよう、この画面を開いたままでお待ちください。";

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <StatusBadge status={runtime.status} />
        <div className="space-y-2">
          <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
            TABLE ASSIGNMENT
          </p>
          <h2 className="text-2xl leading-tight font-semibold tracking-[-0.03em] text-stone-950">
            {isReadyState
              ? "相手の準備完了を待っています"
              : "卓が確定しました。すぐ向かってください"}
          </h2>
          <p className="text-sm leading-6 text-stone-700">
            {isReadyState
              ? "あなたの案内は完了しています。相手もそろい次第、このまま対戦開始に進みます。"
              : "卓番号と相手を確認して、迷わずその卓へ向かってください。開始前の確認はこの画面にまとまっています。"}
          </p>
        </div>
      </section>

      <Card className="rounded-[1.5rem] border border-lime-200/80 bg-linear-to-br from-lime-50 via-emerald-50 to-white py-0 shadow-[0_18px_40px_-30px_rgba(76,145,73,0.45)] ring-1 ring-lime-100/70">
        <CardContent className="space-y-4 px-5 py-5">
          {hasTable ? (
            <>
              <div className="rounded-[1.25rem] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
                <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-lime-700 uppercase">
                  Table
                </p>
                <p className="mt-2 text-[2.6rem] leading-none font-semibold tracking-[-0.05em] text-stone-950">
                  {runtime.table?.tableNumber} 卓
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">{runtime.table?.gameTitle}</p>
              </div>

              <dl className="space-y-3 rounded-[1.25rem] border border-white/70 bg-white px-4 py-4 shadow-sm text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-stone-500">ゲーム</dt>
                  <dd className="text-right font-semibold text-stone-950">
                    {runtime.table?.gameTitle}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-stone-500">対戦相手</dt>
                  <dd className="text-right font-semibold text-stone-950">{opponentLabel}</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-stone-300 bg-white/85 px-4 py-4 text-sm leading-6 text-stone-700">
              卓情報を確認しています。数秒たっても卓番号が出ない場合は、近くのスタッフへ声をかけてください。
            </div>
          )}
        </CardContent>
      </Card>

      {runtime.opponentReady ? (
        <Card className="rounded-[1.5rem] border border-emerald-200/80 bg-emerald-50/70 py-0">
          <CardContent className="px-5 py-4 text-sm leading-6 text-emerald-950">
            相手の準備は確認済みです。案内が切り替わるまで、そのまま卓でお待ちください。
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <Button
          type="button"
          size="lg"
          disabled={true}
          aria-disabled="true"
          className="h-12 w-full rounded-2xl bg-stone-950 text-base font-semibold text-stone-50 hover:bg-stone-800"
        >
          {primaryLabel}
        </Button>

        {!isReadyState ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={true}
            aria-disabled="true"
            className="h-12 w-full rounded-2xl border-stone-300 bg-white text-base font-semibold text-stone-900 hover:bg-stone-50"
          >
            開始前に戻る導線は次タスクで接続予定です
          </Button>
        ) : null}

        <p className="text-sm leading-6 text-stone-600">
          {hasTable ? helperCopy : "卓情報がそろうまで操作はできません。"}
        </p>
      </section>
    </div>
  );
}
