import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdminClient } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

import { publishInvalidation } from "@/lib/realtime/publisher";
import { ADMIN_REALTIME_EVENT, PARTICIPANT_REALTIME_EVENT } from "@/lib/realtime/channels";

describe("publishInvalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes one broadcast per scope with the scoped event type", async () => {
    const send = vi.fn().mockResolvedValueOnce("ok").mockResolvedValueOnce("ok");
    const removeChannel = vi.fn().mockResolvedValue(undefined);
    const channel = vi.fn(() => ({
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
    expect(removeChannel).toHaveBeenCalledTimes(2);
  });

  it("swallows send failures so mutation callers do not fail", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const removeChannel = vi.fn().mockResolvedValue(undefined);

    getSupabaseAdminClient.mockReturnValue({
      channel: vi.fn(() => ({
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
});
