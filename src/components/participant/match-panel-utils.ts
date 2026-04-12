"use client";

import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";
import { dispatchParticipantRuntimeUpdated } from "@/lib/participant-runtime-events";
import { getParticipantSessionToken } from "@/lib/session/participant-client-session";

type ActionResponse<TData> = {
  data?: TData;
  error?: {
    message?: string;
  };
};

export function getOpponentLabel(runtime: ParticipantRuntimeState): string {
  if (runtime.match?.isStaffMatch) {
    return "運営スタッフ";
  }

  return runtime.opponent?.nickname ?? "確認中";
}

export function getMatchLocationSummary(runtime: ParticipantRuntimeState): string {
  if (!runtime.table) {
    return "卓情報を確認しています";
  }

  return `${runtime.table.tableNumber} 卓 / ${runtime.table.gameTitle}`;
}

export function formatBetAmount(amount: number | null): string {
  if (amount === null) {
    return "確定中";
  }

  return `${amount} チップ`;
}

export function formatResultDelta(delta: number | null): string {
  if (delta === null) {
    return "集計中";
  }

  if (delta > 0) {
    return `+${delta}`;
  }

  return `${delta}`;
}

export function formatResultConfirmedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export async function postParticipantAction<TData>(
  path: string,
  options: {
    body?: Record<string, unknown>;
    defaultErrorMessage: string;
  },
): Promise<TData> {
  const sessionToken = getParticipantSessionToken();

  if (!sessionToken) {
    throw new Error("参加セッションが見つかりません。参加登録画面から入り直してください。");
  }

  const response = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const payload = (await response.json().catch(() => null)) as ActionResponse<TData> | null;

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.error?.message ?? options.defaultErrorMessage);
  }

  return payload.data;
}

export function publishRuntimeUpdate(runtime: ParticipantRuntimeState): void {
  dispatchParticipantRuntimeUpdated(runtime);
}
