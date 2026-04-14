import type { RankingSnapshot } from "@/lib/contracts/ranking";

const RANKING_REQUEST_TIMEOUT_MS = 8000;
const MAX_RANKING_ATTEMPTS = 2;

type RankingResponse = {
  data?: RankingSnapshot;
  error?: {
    message?: string;
  };
};

async function loadRankingSnapshotOnce(
  fallbackMessage: string,
  timeoutMessage: string,
): Promise<RankingSnapshot> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, RANKING_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/ranking", {
      method: "GET",
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as RankingResponse | null;

    if (!response.ok || !payload?.data) {
      throw new Error(payload?.error?.message ?? fallbackMessage);
    }

    return payload.data;
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      throw new Error(timeoutMessage);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function loadRankingSnapshot(
  fallbackMessage: string,
  timeoutMessage: string,
): Promise<RankingSnapshot> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RANKING_ATTEMPTS; attempt += 1) {
    try {
      return await loadRankingSnapshotOnce(fallbackMessage, timeoutMessage);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("ランキングの取得に失敗しました。");

      const isRetryableTimeout =
        lastError.message === timeoutMessage || lastError.name === "AbortError";
      const isRetryableNetworkError = lastError instanceof TypeError;

      if (attempt < MAX_RANKING_ATTEMPTS && (isRetryableTimeout || isRetryableNetworkError)) {
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error(fallbackMessage);
}
