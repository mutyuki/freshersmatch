import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useParticipantHeartbeat } from "@/hooks/useParticipantHeartbeat";

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useParticipantHeartbeat", () => {
  beforeEach(() => {
    const store = new Map<string, string>();

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          store.delete(key);
        }),
        clear: vi.fn(() => {
          store.clear();
        }),
      },
    });

    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  it("does not send heartbeat when disabled", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));

    renderHook(() => useParticipantHeartbeat(false));

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send heartbeat without a saved session token", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));

    renderHook(() => useParticipantHeartbeat(true));

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends an immediate heartbeat and repeats with bearer authorization", async () => {
    window.localStorage.setItem("freshers-match.participant-session-token", "session-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));

    renderHook(() => useParticipantHeartbeat(true));
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/participant/heartbeat", {
      method: "POST",
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("swallows fetch rejections and keeps future heartbeats running", async () => {
    window.localStorage.setItem("freshers-match.participant-session-token", "session-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(new Response(null));

    renderHook(() => useParticipantHeartbeat(true));
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("also swallows non-ok responses", async () => {
    window.localStorage.setItem("freshers-match.participant-session-token", "session-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response(null));

    renderHook(() => useParticipantHeartbeat(true));
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops scheduling heartbeat after unmount", async () => {
    window.localStorage.setItem("freshers-match.participant-session-token", "session-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));

    const { unmount } = renderHook(() => useParticipantHeartbeat(true));
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      vi.advanceTimersByTime(20_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("skips interval ticks while a heartbeat request is still in flight", async () => {
    window.localStorage.setItem("freshers-match.participant-session-token", "session-token");

    let resolveFetch: (() => void) | null = null;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = () => resolve(new Response(null));
        }),
    );

    renderHook(() => useParticipantHeartbeat(true));
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch?.();
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
