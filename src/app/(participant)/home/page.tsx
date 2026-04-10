"use client";

import { useEffect, type JSX } from "react";
import { useRouter } from "next/navigation";

import { ParticipantShell } from "@/components/participant/participant-shell";
import { useParticipantRuntime } from "@/hooks/useParticipantRuntime";

export default function HomePage(): JSX.Element {
  const router = useRouter();
  const { state, isLoading } = useParticipantRuntime();

  useEffect(() => {
    if (!isLoading && !state) {
      router.replace("/join");
    }
  }, [isLoading, router, state]);

  if (isLoading) {
    return (
      <ParticipantShell title="参加情報を確認しています...">
        <div className="space-y-4 text-sm leading-6 text-stone-700">
          <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 px-4 py-4">
            保存済みの参加情報を読み込み中です。画面をそのまま開いたままでお待ちください。
          </div>
        </div>
      </ParticipantShell>
    );
  }

  if (!state) {
    return (
      <ParticipantShell title="参加情報を確認しています...">
        <div className="space-y-4 text-sm leading-6 text-stone-700">
          <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 px-4 py-4">
            セッションが見つからないため、参加登録画面へ戻ります。
          </div>
        </div>
      </ParticipantShell>
    );
  }

  return (
    <ParticipantShell title="参加登録が完了しました">
      <div className="space-y-4 text-sm leading-6 text-stone-700">
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">
          {state.nickname}{" "}
          さんで参加中です。再読み込み後も、いまの状態からこの画面に戻れるようになりました。
        </div>
        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 px-4 py-4">
          <dl className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-stone-500">現在の状態</dt>
              <dd className="font-semibold text-stone-900">{state.status}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-stone-500">チップ</dt>
              <dd className="font-semibold text-stone-900">{state.chipBalance}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-stone-500">待機開始時刻</dt>
              <dd className="font-semibold text-stone-900">
                {state.queuedAt ? "取得済み" : "未待機"}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </ParticipantShell>
  );
}
