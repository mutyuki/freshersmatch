import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRealtimeClient } = vi.hoisted(() => ({
  createRealtimeClient: vi.fn(),
}));

vi.mock("@/lib/realtime/client", () => ({
  createRealtimeClient,
}));

import { useRankingRealtime } from "@/hooks/useRankingRealtime";
import { RANKING_REALTIME_EVENT, getRankingChannelName } from "@/lib/realtime/channels";

const REALTIME_SUBSCRIBE_STATES = {
  SUBSCRIBED: "SUBSCRIBED",
  TIMED_OUT: "TIMED_OUT",
  CLOSED: "CLOSED",
  CHANNEL_ERROR: "CHANNEL_ERROR",
} as const;

type RealtimeSubscribeStatus =
  (typeof REALTIME_SUBSCRIBE_STATES)[keyof typeof REALTIME_SUBSCRIBE_STATES];

describe("useRankingRealtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("refreshes on ranking invalidation and after reconnect recovery", async () => {
    let broadcastCallback:
      | ((payload: { payload: { eventType: string; eventId: string; occurredAt: string } }) => void)
      | undefined;
    let subscribeCallback: ((status: RealtimeSubscribeStatus) => void) | undefined;
    const removeChannel = vi.fn();
    const channel = {
      on: vi.fn((_type: string, _filter: { event: string }, callback: typeof broadcastCallback) => {
        broadcastCallback = callback;
        return channel;
      }),
      subscribe: vi.fn((callback: typeof subscribeCallback) => {
        subscribeCallback = callback;
        return channel;
      }),
    };

    createRealtimeClient.mockReturnValue({
      channel: vi.fn(() => channel),
      removeChannel,
    });

    const refresh = vi.fn().mockResolvedValue(undefined);

    const { unmount } = renderHook(() =>
      useRankingRealtime({
        enabled: true,
        eventId: "event-1",
        refresh,
      }),
    );

    await act(async () => {
      broadcastCallback?.({
        payload: {
          eventType: RANKING_REALTIME_EVENT,
          eventId: "event-1",
          occurredAt: "2026-04-12T00:00:00.000Z",
        },
      });
    });

    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      subscribeCallback?.(REALTIME_SUBSCRIBE_STATES.TIMED_OUT);
      vi.advanceTimersByTime(30_000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(refresh).toHaveBeenCalledTimes(2);

    act(() => {
      subscribeCallback?.(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(refresh).toHaveBeenCalledTimes(3);
    expect(createRealtimeClient().channel).toHaveBeenCalledWith(getRankingChannelName("event-1"));

    unmount();

    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
