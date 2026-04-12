"use client";

import { useState, type JSX } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/participant/status-badge";
import {
  formatResultConfirmedAt,
  formatResultDelta,
  postParticipantAction,
} from "@/components/participant/match-panel-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";

export function ResultConfirmedPanel(props: { runtime: ParticipantRuntimeState }): JSX.Element {
  const { runtime } = props;
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const confirmedAtLabel = formatResultConfirmedAt(runtime.resultConfirmedAt);

  async function handleAcknowledge(): Promise<void> {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await postParticipantAction<ParticipantRuntimeState>("/api/participant/result/ack", {
        defaultErrorMessage:
          "結果確認に失敗しました。通信状況を確認してから、もう一度お試しください。",
      });

      router.push("/home");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "結果確認に失敗しました。少し待ってからもう一度お試しください。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <StatusBadge status="result_confirmed" />
        <div className="space-y-2">
          <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
            RESULT CONFIRMED
          </p>
          <h2 className="text-2xl leading-tight font-semibold tracking-[-0.03em] text-stone-950">
            結果が確定しました
          </h2>
          <p className="text-sm leading-6 text-stone-700">
            チップ更新を確認したら、次の案内へ進めます。確認ボタンを押すまで直前の対戦結果を表示し続けます。
          </p>
        </div>
      </section>

      <Card className="rounded-[1.5rem] border border-teal-200/80 bg-linear-to-br from-teal-50 via-emerald-50 to-white py-0 shadow-[0_18px_40px_-30px_rgba(13,148,136,0.32)] ring-1 ring-teal-100/70">
        <CardContent className="space-y-4 px-5 py-5">
          <div className="rounded-[1.25rem] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
            <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-teal-700 uppercase">
              Chip update
            </p>
            <p className="mt-2 text-[2.6rem] leading-none font-semibold tracking-[-0.05em] text-stone-950">
              {formatResultDelta(runtime.resultDelta)}
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-600">今回の増減</p>
          </div>

          <dl className="space-y-3 rounded-[1.25rem] border border-white/70 bg-white px-4 py-4 shadow-sm text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-stone-500">現在のチップ</dt>
              <dd className="text-right font-semibold text-stone-950">{runtime.chipBalance}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-stone-500">確定時刻</dt>
              <dd className="text-right font-semibold text-stone-950">
                {confirmedAtLabel ?? "確認中"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <Button
          type="button"
          size="lg"
          disabled={isSubmitting}
          onClick={handleAcknowledge}
          className="h-14 w-full rounded-2xl bg-stone-950 text-base font-semibold text-stone-50 hover:bg-stone-800"
        >
          {isSubmitting ? "結果を確認しています..." : "結果を確認して次へ"}
        </Button>

        <p className="text-sm leading-6 text-stone-600">
          ボタンを押すとホームへ戻り、次のマッチングを始められる状態に切り替わります。
        </p>

        {errorMessage ? <p className="text-sm leading-6 text-red-700">{errorMessage}</p> : null}
      </section>
    </div>
  );
}
