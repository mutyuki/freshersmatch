import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdminClient, rpc, getParticipantRuntimeState } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  rpc: vi.fn(),
  getParticipantRuntimeState: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

vi.mock("@/lib/services/participant-service", () => ({
  getParticipantRuntimeState,
}));

import { executeStartQueue } from "@/lib/services/matching-service";

describe("matching service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSupabaseAdminClient.mockReturnValue({
      rpc,
    });
  });

  it("starts queueing through the RPC and reloads the participant runtime", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          match_id: null,
          participant_status: "queueing",
        },
      ],
      error: null,
    });
    getParticipantRuntimeState.mockResolvedValue({
      participantId: "participant-1",
      status: "queueing",
    });

    await expect(
      executeStartQueue({
        participantId: "participant-1",
      }),
    ).resolves.toEqual({
      participantId: "participant-1",
      status: "queueing",
    });

    expect(rpc).toHaveBeenCalledWith("start_queue_and_try_match", {
      p_participant_id: "participant-1",
    });
    expect(getParticipantRuntimeState).toHaveBeenCalledWith("participant-1");
  });

  it("maps status conflicts to a 409 app error", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Participant is not in registered status: queueing",
      },
    });

    await expect(
      executeStartQueue({
        participantId: "participant-1",
      }),
    ).rejects.toMatchObject({
      code: "participant_status_conflict",
      status: 409,
    });
  });
});
