import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyParticipantSession, executeStartQueue } = vi.hoisted(() => ({
  verifyParticipantSession: vi.fn(),
  executeStartQueue: vi.fn(),
}));

vi.mock("@/lib/auth/participant-session", () => ({
  verifyParticipantSession,
}));

vi.mock("@/lib/services/matching-service", () => ({
  executeStartQueue,
}));

import { POST as startMatchingPost } from "@/app/api/matching/start/route";

describe("matching start api route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a 401 json error when the bearer token is missing", async () => {
    const response = await startMatchingPost(
      new Request("http://localhost/api/matching/start", {
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "participant_session_missing",
        message: "Participant session is required.",
      },
    });
    expect(response.status).toBe(401);
    expect(verifyParticipantSession).not.toHaveBeenCalled();
  });

  it("starts matching with bearer authorization and returns runtime data", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeStartQueue.mockResolvedValue({
      participantId: "participant-1",
      status: "queueing",
    });

    const response = await startMatchingPost(
      new Request("http://localhost/api/matching/start", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
        participantId: "participant-1",
        status: "queueing",
      },
    });
    expect(response.status).toBe(200);
    expect(verifyParticipantSession).toHaveBeenCalledWith("session-token");
    expect(executeStartQueue).toHaveBeenCalledWith({
      participantId: "participant-1",
    });
  });
});
