"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/participant/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";
import { getParticipantSessionToken } from "@/lib/session/participant-client-session";

function getElapsedSeconds(queuedAt: string | null, now: number): number | null {
  if (!queuedAt) {
    return null;
  }

  const queuedAtMs = new Date(queuedAt).getTime();

  if (Number.isNaN(queuedAtMs)) {
    return null;
  }

  return Math.max(0, Math.floor((now - queuedAtMs) / 1000));
}

function formatElapsedTime(seconds: number | null): string {
  if (seconds === null) {
    return "--:--";
  }

  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
}

export function QueuePanel(props: { runtime: ParticipantRuntimeState }): JSX.Element {
  const { runtime } = props;
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const elapsedSeconds = useMemo(
    () => getElapsedSeconds(runtime.queuedAt, now),
    [now, runtime.queuedAt],
  );
  const waitTimeLabel = formatElapsedTime(elapsedSeconds);
  const hasQueueTimestamp = elapsedSeconds !== null;

  async function handleCancelQueue(): Promise<void> {
    if (isCancelling) {
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    try {
      const sessionToken = getParticipantSessionToken();

      if (!sessionToken) {
        setCancelError("参加セッションが見つかりません。参加登録画面から入り直してください。");
        return;
      }

      const response = await fetch("/api/matching/cancel", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: {
          message?: string;
        };
      } | null;

      if (!response.ok) {
        setCancelError(
          payload?.error?.message ??
            "待機の終了に失敗しました。少し待ってからもう一度お試しください。",
        );
        return;
      }

      router.push("/home");
    } catch {
      setCancelError("通信に失敗しました。電波状況を確認してからもう一度お試しください。");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <StatusBadge status="queueing" />
        <div className="space-y-2">
          <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
            MATCHMAKER
          </p>
          <h2 className="text-2xl leading-tight font-semibold tracking-[-0.03em] text-stone-950">
            次の卓を探しています
          </h2>
          <p className="text-sm leading-6 text-stone-700">
            人対人を優先して、空いている卓へ順番に案内します。画面が切り替わったらそのまま卓へ向かってください。
          </p>
        </div>
      </section>

      <Card className="rounded-[1.5rem] border border-orange-200/80 bg-linear-to-br from-orange-50 via-amber-50 to-white py-0 shadow-[0_18px_40px_-30px_rgba(194,101,37,0.55)] ring-1 ring-orange-100/70">
        <CardContent className="space-y-3 px-5 py-5">
          <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-orange-700 uppercase">
            Wait time
          </p>
          <p className="text-[3rem] leading-none font-semibold tracking-[-0.05em] text-stone-950">
            {waitTimeLabel}
          </p>
          <p className="text-sm leading-6 text-stone-700">
            {hasQueueTimestamp
              ? "最後に戦った相手は可能なら避けつつ、部屋の回転が止まらないようにマッチを探しています。"
              : "待機開始時刻を確認しています。数秒たっても更新されない場合は近くのスタッフへ知らせてください。"}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-[1.5rem] border border-stone-200/90 bg-stone-50/70 py-0">
        <CardContent className="space-y-3 px-5 py-5">
          <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
            What to do now
          </p>
          <div className="rounded-[1.25rem] border border-white/70 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm font-semibold text-stone-950">このまま近くで待機してください</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              卓が確定した瞬間に、この画面が自動で卓番号と相手案内へ切り替わります。
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isCancelling}
          onClick={handleCancelQueue}
          className="h-12 w-full rounded-2xl border-stone-300 bg-white text-base font-semibold text-stone-900 hover:bg-stone-50"
        >
          {isCancelling ? "待機を終了しています..." : "待機をやめる"}
        </Button>

        <p className="text-sm leading-6 text-stone-600">
          少し席を外すときは待機をやめて大丈夫です。再開したくなったらホームからすぐ戻れます。
        </p>

        {cancelError ? <p className="text-sm leading-6 text-red-700">{cancelError}</p> : null}
      </section>
    </div>
  );
}
