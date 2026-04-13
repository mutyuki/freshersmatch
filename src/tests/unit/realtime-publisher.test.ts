import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdminClient } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

import { publishInvalidation } from "@/lib/realtime/publisher";
import {
  ADMIN_REALTIME_EVENT,
  PARTICIPANT_REALTIME_EVENT,
  getInvalidationChannelName,
} from "@/lib/realtime/channels";

describe("publishInvalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes one broadcast per scope with the scoped event type", async () => {
    const subscribe = vi.fn((callback: (status: "SUBSCRIBED") => void) => {
      callback("SUBSCRIBED");
    });
    const send = vi.fn().mockResolvedValueOnce("ok").mockResolvedValueOnce("ok");
    const removeChannel = vi.fn().mockResolvedValue(undefined);
    const channel = vi.fn(() => ({
      subscribe,
      send,
    }));

    getSupabaseAdminClient.mockReturnValue({
      channel,
      removeChannel,
    });

    await publishInvalidation({
      eventId: "event-1",
      scopes: ["participant", "admin"],
      participantIds: ["participant-1"],
      matchId: "match-1",
    });

    expect(send).toHaveBeenNthCalledWith(1, {
      type: "broadcast",
      event: PARTICIPANT_REALTIME_EVENT,
      payload: expect.objectContaining({
        eventType: PARTICIPANT_REALTIME_EVENT,
        eventId: "event-1",
        participantIds: ["participant-1"],
        matchId: "match-1",
        tableId: null,
      }),
    });
    expect(send).toHaveBeenNthCalledWith(2, {
      type: "broadcast",
      event: ADMIN_REALTIME_EVENT,
      payload: expect.objectContaining({
        eventType: ADMIN_REALTIME_EVENT,
        eventId: "event-1",
      }),
    });
    expect(channel).toHaveBeenCalledWith(getInvalidationChannelName("event-1"));
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("swallows send failures so mutation callers do not fail", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const removeChannel = vi.fn().mockResolvedValue(undefined);

    getSupabaseAdminClient.mockReturnValue({
      channel: vi.fn(() => ({
        subscribe: vi.fn((callback: (status: "SUBSCRIBED") => void) => {
          callback("SUBSCRIBED");
        }),
        send: vi.fn().mockRejectedValue(new Error("socket down")),
      })),
      removeChannel,
    });

    await expect(
      publishInvalidation({
        eventId: "event-1",
        scopes: ["participant"],
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("swallows subscribe failures so mutation callers do not fail", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const removeChannel = vi.fn().mockResolvedValue(undefined);

    getSupabaseAdminClient.mockReturnValue({
      channel: vi.fn(() => ({
        subscribe: vi.fn((callback: (status: "CHANNEL_ERROR", error?: Error) => void) => {
          callback("CHANNEL_ERROR", new Error("subscribe failed"));
        }),
        send: vi.fn(),
      })),
      removeChannel,
    });

    await expect(
      publishInvalidation({
        eventId: "event-1",
        scopes: ["participant"],
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("fails fast when subscribe never resolves so APIs do not stall behind realtime", async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const removeChannel = vi.fn().mockResolvedValue(undefined);

    getSupabaseAdminClient.mockReturnValue({
      channel: vi.fn(() => ({
        subscribe: vi.fn(),
        send: vi.fn(),
      })),
      removeChannel,
    });

    const publishPromise = publishInvalidation({
      eventId: "event-1",
      scopes: ["participant"],
    });

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(publishPromise).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    expect(removeChannel).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("continues publishing later scopes when one send fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const removeChannel = vi.fn().mockResolvedValue(undefined);
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("socket down"))
      .mockResolvedValueOnce("ok");

    getSupabaseAdminClient.mockReturnValue({
      channel: vi.fn(() => ({
        subscribe: vi.fn((callback: (status: "SUBSCRIBED") => void) => {
          callback("SUBSCRIBED");
        }),
        send,
      })),
      removeChannel,
    });

    await expect(
      publishInvalidation({
        eventId: "event-1",
        scopes: ["participant", "admin"],
      }),
    ).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });
});
