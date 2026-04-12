"use client";

import type { JSX } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/participant/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";
import type { TableStatus } from "@/lib/domain/table-status";
import { getParticipantSessionToken } from "@/lib/session/participant-client-session";
import { cn } from "@/lib/utils";

const STATUS_COPY: Record<ParticipantRuntimeState["status"], string> = {
  unregistered: "参加登録がまだ完了していません。登録内容を確認してから進んでください。",
  registered: "準備ができたら次のランダムマッチへ進めます。まずは情報を確認しましょう。",
  queueing: "現在は待機列に入っています。次の案内は自動で反映されます。",
  match_reserved: "対戦の案内が進んでいます。卓番号と相手情報の確認へ進みます。",
  ready: "開始準備はできています。相手の準備完了を待って次へ進みます。",
  playing: "対戦中です。卓情報と進行中の案内を確認してください。",
  claiming_win: "勝利申告を送信済みです。相手の確認が終わるまでお待ちください。",
  awaiting_result_approval: "結果確認が届いています。対戦結果を確認して承認してください。",
  result_confirmed: "結果は確定済みです。チップ反映後、次のマッチへ進めます。",
  paused: "進行が一時停止されています。案内があるまでそのままお待ちください。",
  disqualified: "運営判断で参加停止中です。必要があれば近くのスタッフへ声をかけてください。",
  disconnected: "接続を復旧中です。復帰先の画面へ自動で戻ります。",
};

function getTableStatusLabel(status: TableStatus): string {
  switch (status) {
    case "available":
      return "案内可能";
    case "reserved":
      return "案内中";
    case "in_use":
      return "対戦中";
    case "admin_hold":
      return "使用停止中";
    default:
      return status;
  }
}

function getStartDisabledReason(runtime: ParticipantRuntimeState): string | null {
  if (runtime.canStartMatching) {
    return null;
  }

  if (runtime.chipBalance <= 0) {
    return "チップが 0 のため、次のマッチングを開始できません。";
  }

  return "現在の状態ではマッチング開始はできません。進行中の案内を確認してください。";
}

export function HomePanel(props: { runtime: ParticipantRuntimeState }): JSX.Element {
  const { runtime } = props;
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const disabledReason = getStartDisabledReason(runtime);

  async function handleStartMatching(): Promise<void> {
    if (!runtime.canStartMatching || isStarting) {
      return;
    }

    setIsStarting(true);
    setStartError(null);

    try {
      const sessionToken = getParticipantSessionToken();

      if (!sessionToken) {
        setStartError("参加セッションが見つかりません。もう一度参加登録を行ってください。");
        return;
      }

      const response = await fetch("/api/matching/start", {
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
        setStartError(
          payload?.error?.message ??
            "マッチング開始に失敗しました。少し待ってからもう一度お試しください。",
        );
        return;
      }

      router.push("/match");
    } catch {
      setStartError("通信に失敗しました。電波状況を確認してからもう一度お試しください。");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <StatusBadge status={runtime.status} />
        <div className="space-y-2">
          <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
            {runtime.nickname} さんのホーム
          </p>
          <p className="text-sm leading-6 text-stone-700">{STATUS_COPY[runtime.status]}</p>
        </div>
      </section>

      <Card className="rounded-[1.5rem] border border-amber-200/80 bg-linear-to-br from-amber-50 via-orange-50 to-white py-0 shadow-[0_18px_40px_-30px_rgba(180,97,36,0.55)] ring-1 ring-amber-100/80">
        <CardContent className="space-y-3 px-5 py-5">
          <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-amber-700 uppercase">
            Official Chips
          </p>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[2.4rem] leading-none font-semibold tracking-[-0.04em] text-stone-950">
                {runtime.chipBalance.toLocaleString("ja-JP")}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                ランキング順位や次の対戦可否は、この正式チップ数で決まります。
              </p>
            </div>
            <div className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs font-medium text-amber-900 shadow-sm">
              現在所持
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[1.5rem] border border-stone-200/90 bg-stone-50/70 py-0">
        <CardContent className="space-y-4 px-5 py-5">
          <div className="space-y-1">
            <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
              Current status
            </p>
            <p className="text-sm leading-6 text-stone-700">
              今の状態に合わせて、次に必要な操作だけを表示します。
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-[1.25rem] border border-white/70 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-stone-950">現在の参加ステータス</p>
              <p className="text-sm leading-6 text-stone-600">{STATUS_COPY[runtime.status]}</p>
            </div>
            <StatusBadge status={runtime.status} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[1.5rem] border border-stone-200/90 bg-stone-50/70 py-0">
        <CardContent className="space-y-4 px-5 py-5">
          <div className="space-y-1">
            <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
              Table info
            </p>
            <p className="text-sm leading-6 text-stone-700">
              卓が決まると、このカードに番号とゲーム名が表示されます。
            </p>
          </div>

          {runtime.table ? (
            <div className="rounded-[1.25rem] border border-white/70 bg-white px-4 py-4 shadow-sm">
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-stone-500">卓番号</dt>
                  <dd className="text-right font-semibold text-stone-950">
                    {runtime.table.tableNumber} 卓
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-stone-500">ゲーム</dt>
                  <dd className="text-right font-semibold text-stone-950">
                    {runtime.table.gameTitle}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-stone-500">卓状態</dt>
                  <dd className="text-right font-semibold text-stone-950">
                    {getTableStatusLabel(runtime.table.status)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-stone-300 bg-white/80 px-4 py-4 text-sm leading-6 text-stone-700">
              まだ卓は割り当てられていません。準備ができたらマッチング開始を押すと、空いている卓へ順番に案内されます。
            </div>
          )}
        </CardContent>
      </Card>

      <Link
        href="/ranking"
        className={cn(
          "block rounded-[1.5rem] border border-stone-200/90 bg-white/90 px-5 py-4 text-left shadow-sm transition-colors",
          "hover:border-stone-300 hover:bg-white",
        )}
      >
        <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
          Ranking
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-stone-950">ランキングを見る</p>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              現在順位を確認して、次の目標チップ数を見つけましょう。
            </p>
          </div>
          <span className="pt-1 text-sm font-semibold text-stone-700">見る</span>
        </div>
      </Link>

      <section className="space-y-3">
        <Button
          type="button"
          size="lg"
          disabled={!runtime.canStartMatching || isStarting}
          onClick={handleStartMatching}
          className="h-12 w-full rounded-2xl bg-stone-950 text-base font-semibold text-stone-50 hover:bg-stone-800"
        >
          {isStarting ? "マッチングを開始しています..." : "マッチングを開始する"}
        </Button>

        {disabledReason ? (
          <p className="text-sm leading-6 text-stone-600">{disabledReason}</p>
        ) : (
          <p className="text-sm leading-6 text-stone-600">
            待機列にはあとからでも戻れます。少し時間があるタイミングで始めて大丈夫です。
          </p>
        )}

        {startError ? <p className="text-sm leading-6 text-red-700">{startError}</p> : null}
      </section>
    </div>
  );
}
