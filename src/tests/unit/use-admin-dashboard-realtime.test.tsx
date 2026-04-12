import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRealtimeClient } = vi.hoisted(() => ({
  createRealtimeClient: vi.fn(),
}));

vi.mock("@/lib/realtime/client", () => ({
  createRealtimeClient,
}));

import { useAdminDashboardRealtime } from "@/hooks/useAdminDashboardRealtime";
import { ADMIN_REALTIME_EVENT, getAdminChannelName } from "@/lib/realtime/channels";

const REALTIME_SUBSCRIBE_STATES = {
  SUBSCRIBED: "SUBSCRIBED",
  TIMED_OUT: "TIMED_OUT",
  CLOSED: "CLOSED",
  CHANNEL_ERROR: "CHANNEL_ERROR",
} as const;

type RealtimeSubscribeStatus =
  (typeof REALTIME_SUBSCRIBE_STATES)[keyof typeof REALTIME_SUBSCRIBE_STATES];

describe("useAdminDashboardRealtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("subscribes to the admin channel and falls back to polling while disconnected", async () => {
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
      useAdminDashboardRealtime({
        enabled: true,
        eventId: "event-1",
        refresh,
      }),
    );

    await act(async () => {
      broadcastCallback?.({
        payload: {
          eventType: ADMIN_REALTIME_EVENT,
          eventId: "event-1",
          occurredAt: "2026-04-12T00:00:00.000Z",
        },
      });
    });

    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      subscribeCallback?.(REALTIME_SUBSCRIBE_STATES.CLOSED);
      vi.advanceTimersByTime(30_000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(createRealtimeClient().channel).toHaveBeenCalledWith(getAdminChannelName("event-1"));

    unmount();

    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
