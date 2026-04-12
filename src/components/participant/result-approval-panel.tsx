"use client";

import { useState, type JSX } from "react";

import { StatusBadge } from "@/components/participant/status-badge";
import {
  getMatchLocationSummary,
  getOpponentLabel,
  postParticipantAction,
  publishRuntimeUpdate,
} from "@/components/participant/match-panel-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";

export function ResultApprovalPanel(props: { runtime: ParticipantRuntimeState }): JSX.Element {
  const { runtime } = props;
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasMatch = runtime.currentMatchId !== null;

  async function handleDecision(approve: boolean): Promise<void> {
    if (!runtime.currentMatchId || pendingAction) {
      return;
    }

    setPendingAction(approve ? "approve" : "reject");
    setErrorMessage(null);

    try {
      const nextRuntime = await postParticipantAction<ParticipantRuntimeState>(
        "/api/match/approve-result",
        {
          body: {
            matchId: runtime.currentMatchId,
            approve,
          },
          defaultErrorMessage: approve
            ? "結果承認に失敗しました。通信状況を確認してからもう一度お試しください。"
            : "承認しない処理に失敗しました。少し待ってからもう一度お試しください。",
        },
      );

      publishRuntimeUpdate(nextRuntime);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "結果処理に失敗しました。時間をおいてもう一度お試しください。",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <StatusBadge status="awaiting_result_approval" />
        <div className="space-y-2">
          <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
            RESULT APPROVAL
          </p>
          <h2 className="text-2xl leading-tight font-semibold tracking-[-0.03em] text-stone-950">
            相手の勝利申告を確認してください
          </h2>
          <p className="text-sm leading-6 text-stone-700">
            誤タップを避けるため、承認と差し戻しを大きく分けています。内容が違うときだけ下の「承認しない」を使ってください。
          </p>
        </div>
      </section>

      <Card className="rounded-[1.5rem] border border-fuchsia-200/80 bg-linear-to-br from-fuchsia-50 via-rose-50 to-white py-0 shadow-[0_18px_40px_-30px_rgba(190,24,93,0.28)] ring-1 ring-fuchsia-100/70">
        <CardContent className="space-y-4 px-5 py-5">
          <div className="rounded-[1.25rem] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
            <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-fuchsia-700 uppercase">
              Claim
            </p>
            <p className="mt-2 text-2xl leading-tight font-semibold tracking-[-0.04em] text-stone-950">
              {getOpponentLabel(runtime)} さんが勝利申告中です
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {getMatchLocationSummary(runtime)}
            </p>
          </div>

          <div className="rounded-[1.25rem] border border-white/70 bg-white px-4 py-4 text-sm leading-6 text-stone-700 shadow-sm">
            内容に問題がなければ承認してください。承認しない場合は対戦中へ戻り、結果申告をやり直せます。
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <Button
          type="button"
          size="lg"
          disabled={!hasMatch || pendingAction !== null}
          onClick={() => void handleDecision(true)}
          className="h-14 w-full rounded-2xl bg-stone-950 text-base font-semibold text-stone-50 hover:bg-stone-800"
        >
          {pendingAction === "approve" ? "結果を承認しています..." : "承認する"}
        </Button>

        <Card className="rounded-[1.5rem] border border-stone-200/90 bg-stone-50/70 py-0">
          <CardContent className="space-y-3 px-4 py-4">
            <p className="text-sm leading-6 text-stone-700">
              勝敗が違うときだけこちらを使ってください。押すと結果は確定せず、対戦中画面へ戻ります。
            </p>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={!hasMatch || pendingAction !== null}
              onClick={() => void handleDecision(false)}
              className="h-14 w-full rounded-2xl border-stone-300 bg-white text-base font-semibold text-stone-900 hover:bg-stone-50"
            >
              {pendingAction === "reject" ? "差し戻しています..." : "承認しない"}
            </Button>
          </CardContent>
        </Card>

        {errorMessage ? <p className="text-sm leading-6 text-red-700">{errorMessage}</p> : null}
      </section>
    </div>
  );
}
