"use client";

import { useEffect, type JSX } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";
import { getPreferredParticipantRoute } from "@/lib/participant-route";
import {
  clearParticipantSessionToken,
  getParticipantSessionToken,
} from "@/lib/session/participant-client-session";

type RestoreResponse = {
  data?: ParticipantRuntimeState;
  error?: {
    code?: string;
    message?: string;
  };
};

function isUnauthorizedRestore(response: Response, payload: RestoreResponse | null): boolean {
  return response.status === 401 || payload?.error?.code === "participant_session_invalid";
}

export default function RootPage(): JSX.Element {
  const router = useRouter();

  useEffect(() => {
    let isCancelled = false;

    async function routeParticipant(): Promise<void> {
      const sessionToken = getParticipantSessionToken();

      if (!sessionToken) {
        router.replace("/join");
        return;
      }

      try {
        const response = await fetch("/api/participant/session/restore", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionToken,
          }),
        });

        const payload = (await response.json().catch(() => null)) as RestoreResponse | null;

        if (!response.ok || !payload?.data) {
          throw new Error(
            isUnauthorizedRestore(response, payload) ? "unauthorized" : "restore_failed",
          );
        }

        if (isCancelled) {
          return;
        }

        router.replace(
          getPreferredParticipantRoute(payload.data.status, payload.data.lastNonDisconnectStatus),
        );
      } catch {
        if (isCancelled) {
          return;
        }

        clearParticipantSessionToken();
        router.replace("/join");
      }
    }

    void routeParticipant();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.14),_transparent_45%),linear-gradient(180deg,_#f7f1e8_0%,_#efe5d6_100%)] px-6 py-16">
      <div className="w-full max-w-sm rounded-[2rem] border border-stone-200/80 bg-white/85 px-6 py-8 text-center shadow-[0_24px_80px_rgba(120,53,15,0.12)] backdrop-blur-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-stone-900 text-stone-50">
          <Spinner className="size-5" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.32em] text-stone-500">
          Freshers Match
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
          参加情報を確認しています
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-700">
          保存済みのセッションを読み込んでいます。画面が切り替わるまでそのままお待ちください。
        </p>
      </div>
    </main>
  );
}
