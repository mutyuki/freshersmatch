import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createRealtimeClient } = vi.hoisted(() => ({
  createRealtimeClient: vi.fn(),
}));

vi.mock("@/lib/realtime/client", () => ({
  createRealtimeClient,
}));

import { useParticipantRealtime } from "@/hooks/useParticipantRealtime";
import {
  MATCH_REALTIME_EVENT,
  PARTICIPANT_REALTIME_EVENT,
  getParticipantChannelName,
} from "@/lib/realtime/channels";

const REALTIME_SUBSCRIBE_STATES = {
  SUBSCRIBED: "SUBSCRIBED",
  TIMED_OUT: "TIMED_OUT",
  CLOSED: "CLOSED",
  CHANNEL_ERROR: "CHANNEL_ERROR",
} as const;

type ChannelRecord = {
  name: string;
  channel: {
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };
  broadcastCallbacks: Record<string, (payload: { payload: Record<string, unknown> }) => void>;
  subscribeCallback:
    | ((status: (typeof REALTIME_SUBSCRIBE_STATES)[keyof typeof REALTIME_SUBSCRIBE_STATES]) => void)
    | null;
};

function setupRealtimeClient() {
  const channels = new Map<string, ChannelRecord>();
  const removeChannel = vi.fn();

  createRealtimeClient.mockReturnValue({
    channel: vi.fn((name: string) => {
      const channel = {
        on: vi.fn(),
        subscribe: vi.fn(),
      };
      const record: ChannelRecord = {
        name,
        channel,
        broadcastCallbacks: {},
        subscribeCallback: null,
      };
      channels.set(name, record);

      channel.on.mockImplementation(
        (
          _type: string,
          filter: { event: string },
          callback: ChannelRecord["broadcastCallbacks"][string],
        ) => {
          record.broadcastCallbacks[filter.event] = callback;
          return channel;
        },
      );
      channel.subscribe.mockImplementation((callback: ChannelRecord["subscribeCallback"]) => {
        record.subscribeCallback = callback;
        return channel;
      });

      return channel;
    }),
    removeChannel,
  });

  return { channels, removeChannel };
}

describe("useParticipantRealtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("refreshes for participant invalidation that includes the current participant", async () => {
    const { channels } = setupRealtimeClient();
    const refresh = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useParticipantRealtime({
        enabled: true,
        eventId: "event-1",
        participantId: "participant-1",
        refresh,
      }),
    );

    const participantChannel = channels.get(getParticipantChannelName("event-1"));

    await act(async () => {
      participantChannel?.broadcastCallbacks[PARTICIPANT_REALTIME_EVENT]({
        payload: {
          eventType: PARTICIPANT_REALTIME_EVENT,
          eventId: "event-1",
          participantIds: ["participant-1"],
          occurredAt: "2026-04-12T00:00:00.000Z",
        },
      });
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("ignores participant invalidation for a different participant", async () => {
    const { channels } = setupRealtimeClient();
    const refresh = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useParticipantRealtime({
        enabled: true,
        eventId: "event-1",
        participantId: "participant-1",
        refresh,
      }),
    );

    const participantChannel = channels.get(getParticipantChannelName("event-1"));

    await act(async () => {
      participantChannel?.broadcastCallbacks[PARTICIPANT_REALTIME_EVENT]({
        payload: {
          eventType: PARTICIPANT_REALTIME_EVENT,
          eventId: "event-1",
          participantIds: ["participant-2"],
          occurredAt: "2026-04-12T00:00:00.000Z",
        },
      });
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes for match invalidation", async () => {
    const { channels } = setupRealtimeClient();
    const refresh = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useParticipantRealtime({
        enabled: true,
        eventId: "event-1",
        participantId: "participant-1",
        refresh,
      }),
    );

    const matchChannel = channels.get(getParticipantChannelName("event-1"));

    await act(async () => {
      matchChannel?.broadcastCallbacks[MATCH_REALTIME_EVENT]({
        payload: {
          eventType: MATCH_REALTIME_EVENT,
          eventId: "event-1",
          matchId: "match-1",
          occurredAt: "2026-04-12T00:00:00.000Z",
        },
      });
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("uses fallback polling only while a subscription is unhealthy and refreshes once after recovery", async () => {
    const { channels } = setupRealtimeClient();
    const refresh = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useParticipantRealtime({
        enabled: true,
        eventId: "event-1",
        participantId: "participant-1",
        refresh,
      }),
    );

    const participantChannel = channels.get(getParticipantChannelName("event-1"));
    const matchChannel = channels.get(getParticipantChannelName("event-1"));

    act(() => {
      participantChannel?.subscribeCallback?.(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR);
    });

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      participantChannel?.subscribeCallback?.(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      matchChannel?.subscribeCallback?.(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(refresh).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("removes the shared invalidation channel on unmount", () => {
    const { channels, removeChannel } = setupRealtimeClient();

    const { unmount } = renderHook(() =>
      useParticipantRealtime({
        enabled: true,
        eventId: "event-1",
        participantId: "participant-1",
        refresh: vi.fn().mockResolvedValue(undefined),
      }),
    );

    const participantChannel = channels.get(getParticipantChannelName("event-1"));
    const matchChannel = channels.get(getParticipantChannelName("event-1"));

    unmount();

    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledWith(participantChannel?.channel);
    expect(matchChannel).toBe(participantChannel);
  });
});
