import { afterEach, describe, expect, it, vi } from "vitest";

import { loadRankingSnapshot } from "@/lib/ranking/load-ranking-snapshot";

describe("loadRankingSnapshot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns ranking data when the API succeeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            eventId: "event-1",
            entries: [
              {
                participantId: "participant-1",
                nickname: "Alice",
                chipBalance: 24,
                status: "registered",
                rank: 1,
              },
            ],
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await expect(
      loadRankingSnapshot("ランキングの取得に失敗しました。", "タイムアウトしました。"),
    ).resolves.toEqual({
      eventId: "event-1",
      entries: [
        {
          participantId: "participant-1",
          nickname: "Alice",
          chipBalance: 24,
          status: "registered",
          rank: 1,
        },
      ],
    });
  });

  it("fails with the timeout message when the API does not respond", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(init.signal?.reason ?? new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const promise = loadRankingSnapshot(
      "ランキングの取得に失敗しました。",
      "タイムアウトしました。",
    );
    const expectation = expect(promise).rejects.toThrow("タイムアウトしました。");

    await vi.advanceTimersByTimeAsync(16_000);

    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries once and returns data when the second attempt succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(init.signal?.reason ?? new DOMException("Aborted", "AbortError"));
            });
          }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              eventId: "event-1",
              entries: [
                {
                  participantId: "participant-1",
                  nickname: "Alice",
                  chipBalance: 24,
                  status: "registered",
                  rank: 1,
                },
              ],
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    const promise = loadRankingSnapshot(
      "ランキングの取得に失敗しました。",
      "タイムアウトしました。",
    );

    await vi.advanceTimersByTimeAsync(8000);

    await expect(promise).resolves.toEqual({
      eventId: "event-1",
      entries: [
        {
          participantId: "participant-1",
          nickname: "Alice",
          chipBalance: 24,
          status: "registered",
          rank: 1,
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
