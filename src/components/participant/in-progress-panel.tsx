"use client";

import { useState, type JSX } from "react";

import { StatusBadge } from "@/components/participant/status-badge";
import {
  formatBetAmount,
  getMatchLocationSummary,
  getOpponentLabel,
  postParticipantAction,
  publishRuntimeUpdate,
} from "@/components/participant/match-panel-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";

export function InProgressPanel(props: { runtime: ParticipantRuntimeState }): JSX.Element {
  const { runtime } = props;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasMatch = runtime.currentMatchId !== null;
  const canClaimWin = hasMatch && runtime.canClaimWin && !runtime.match?.isStaffMatch;

  async function handleClaimWin(): Promise<void> {
    if (!runtime.currentMatchId || isSubmitting || !canClaimWin) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const nextRuntime = await postParticipantAction<ParticipantRuntimeState>(
        "/api/match/claim-win",
        {
          body: {
            matchId: runtime.currentMatchId,
          },
          defaultErrorMessage:
            "勝利申告に失敗しました。通信状況を確認してから、もう一度お試しください。",
        },
      );

      publishRuntimeUpdate(nextRuntime);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "勝利申告に失敗しました。時間をおいてもう一度お試しください。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <StatusBadge status="playing" />
        <div className="space-y-2">
          <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
            MATCH IN PROGRESS
          </p>
          <h2 className="text-2xl leading-tight font-semibold tracking-[-0.03em] text-stone-950">
            対戦中です
          </h2>
          <p className="text-sm leading-6 text-stone-700">
            対戦が終わったら、この画面から結果を進めます。誤操作を避けるため、結果操作は下の主ボタンだけにまとめています。
          </p>
        </div>
      </section>

      <Card className="rounded-[1.5rem] border border-sky-200/80 bg-linear-to-br from-sky-50 via-cyan-50 to-white py-0 shadow-[0_18px_40px_-30px_rgba(14,116,144,0.4)] ring-1 ring-sky-100/70">
        <CardContent className="space-y-4 px-5 py-5">
          <div className="rounded-[1.25rem] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
            <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-sky-700 uppercase">
              Table
            </p>
            <p className="mt-2 text-2xl leading-tight font-semibold tracking-[-0.04em] text-stone-950">
              {getMatchLocationSummary(runtime)}
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              対戦相手: {getOpponentLabel(runtime)}
            </p>
          </div>

          <dl className="space-y-3 rounded-[1.25rem] border border-white/70 bg-white px-4 py-4 shadow-sm text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-stone-500">対戦相手</dt>
              <dd className="text-right font-semibold text-stone-950">
                {getOpponentLabel(runtime)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-stone-500">固定ベット</dt>
              <dd className="text-right font-semibold text-stone-950">
                {formatBetAmount(runtime.match?.agreedBetAmount ?? null)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {runtime.match?.isStaffMatch ? (
        <Card className="rounded-[1.5rem] border border-amber-200/80 bg-amber-50/75 py-0">
          <CardContent className="space-y-2 px-5 py-4 text-sm leading-6 text-amber-950">
            <p className="font-semibold">運営戦の結果はスタッフが確定します</p>
            <p>
              参加者側の勝利申告は不要です。対戦が終わったら、そのままスタッフの案内を待ってください。
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        {!runtime.match?.isStaffMatch ? (
          <Button
            type="button"
            size="lg"
            disabled={!canClaimWin || isSubmitting}
            onClick={handleClaimWin}
            className="h-14 w-full rounded-2xl bg-stone-950 text-base font-semibold text-stone-50 hover:bg-stone-800"
          >
            {isSubmitting ? "勝利申告を送信しています..." : "勝利を申告する"}
          </Button>
        ) : null}

        <p className="text-sm leading-6 text-stone-600">
          {!hasMatch
            ? "試合情報を確認しています。数秒たっても更新されない場合は近くのスタッフへ知らせてください。"
            : runtime.match?.isStaffMatch
              ? "結果が確定すると自動で次の案内へ進みます。"
              : "申告後は相手の承認待ちへ切り替わります。"}
        </p>

        {errorMessage ? <p className="text-sm leading-6 text-red-700">{errorMessage}</p> : null}
      </section>
    </div>
  );
}
