import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRealtimeClient } = vi.hoisted(() => ({
  createRealtimeClient: vi.fn(),
}));

vi.mock("@/lib/realtime/client", () => ({
  createRealtimeClient,
}));

import { useAdminMatchesRealtime } from "@/hooks/useAdminMatchesRealtime";
import { useAdminTablesRealtime } from "@/hooks/useAdminTablesRealtime";
import { ADMIN_REALTIME_EVENT, getAdminChannelName } from "@/lib/realtime/channels";

const REALTIME_SUBSCRIBE_STATES = {
  SUBSCRIBED: "SUBSCRIBED",
  TIMED_OUT: "TIMED_OUT",
  CLOSED: "CLOSED",
  CHANNEL_ERROR: "CHANNEL_ERROR",
} as const;

type RealtimeSubscribeStatus =
  (typeof REALTIME_SUBSCRIBE_STATES)[keyof typeof REALTIME_SUBSCRIBE_STATES];

describe("admin match and table realtime hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("subscribes matches to the admin channel", async () => {
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
      useAdminMatchesRealtime({
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

  it("subscribes tables to the same admin channel", () => {
    const channel = {
      on: vi.fn(() => channel),
      subscribe: vi.fn(() => channel),
    };

    createRealtimeClient.mockReturnValue({
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    });

    const refresh = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useAdminTablesRealtime({
        enabled: true,
        eventId: "event-9",
        refresh,
      }),
    );

    expect(createRealtimeClient().channel).toHaveBeenCalledWith(getAdminChannelName("event-9"));
  });
});
