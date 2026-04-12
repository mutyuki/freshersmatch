import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  registerParticipant,
  restoreParticipantSession,
  getParticipantRuntimeState,
  heartbeatParticipant,
  touchParticipantSession,
  verifyParticipantSession,
} = vi.hoisted(() => ({
  registerParticipant: vi.fn(),
  restoreParticipantSession: vi.fn(),
  getParticipantRuntimeState: vi.fn(),
  heartbeatParticipant: vi.fn(),
  touchParticipantSession: vi.fn(),
  verifyParticipantSession: vi.fn(),
}));

vi.mock("@/lib/services/participant-service", () => ({
  registerParticipant,
  restoreParticipantSession,
  getParticipantRuntimeState,
  heartbeatParticipant,
}));

vi.mock("@/lib/auth/participant-session", () => ({
  touchParticipantSession,
  verifyParticipantSession,
}));

import { AppError } from "@/lib/domain/errors";
import { POST as heartbeatParticipantPost } from "@/app/api/participant/heartbeat/route";
import { GET as getParticipantMe } from "@/app/api/participant/me/route";
import { POST as registerParticipantPost } from "@/app/api/participant/register/route";

describe("participant api routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns wrapped data for participant registration", async () => {
    registerParticipant.mockResolvedValue({
      participant: {
        id: "participant-1",
      },
      sessionToken: "session-token",
    });

    const response = await registerParticipantPost(
      new Request("http://localhost/api/participant/register", {
        method: "POST",
        body: JSON.stringify({
          venueCode: "VENUE-1",
          nickname: "Alice",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
        participant: {
          id: "participant-1",
        },
        sessionToken: "session-token",
      },
    });
    expect(response.status).toBe(200);
    expect(registerParticipant).toHaveBeenCalledWith({
      venueCode: "VENUE-1",
      nickname: "Alice",
    });
  });

  it("returns a 401 json error when the bearer token is missing", async () => {
    const response = await getParticipantMe(
      new Request("http://localhost/api/participant/me", {
        method: "GET",
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
    expect(touchParticipantSession).not.toHaveBeenCalled();
  });

  it("touches the participant session before loading runtime state", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    touchParticipantSession.mockResolvedValue(undefined);
    getParticipantRuntimeState.mockResolvedValue({
      participantId: "participant-1",
      eventId: "event-1",
      nickname: "Alice",
      status: "registered",
      lastNonDisconnectStatus: "registered",
      chipBalance: 500,
      currentMatchId: null,
      queuedAt: null,
      table: null,
      match: null,
      opponent: null,
      opponentReady: false,
      winnerParticipantId: null,
      winnerClaimedByParticipantId: null,
      disqualifiedReason: null,
      resultDelta: null,
      resultConfirmedAt: null,
      canStartMatching: true,
      canClaimWin: false,
    });

    const response = await getParticipantMe(
      new Request("http://localhost/api/participant/me", {
        method: "GET",
        headers: {
          Authorization: "Bearer session-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(touchParticipantSession).toHaveBeenCalledWith("session-1");
    expect(getParticipantRuntimeState).toHaveBeenCalledWith("participant-1");
  });

  it("accepts heartbeat requests that only send bearer authorization", async () => {
    heartbeatParticipant.mockResolvedValue(undefined);

    const response = await heartbeatParticipantPost(
      new Request("http://localhost/api/participant/heartbeat", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
        ok: true,
      },
    });
    expect(response.status).toBe(200);
    expect(heartbeatParticipant).toHaveBeenCalledWith({
      sessionToken: "session-token",
    });
  });

  it("returns app errors from downstream services as json", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    getParticipantRuntimeState.mockRejectedValue(
      new AppError("participant_not_found", "Participant was not found.", 404),
    );

    const response = await getParticipantMe(
      new Request("http://localhost/api/participant/me", {
        method: "GET",
        headers: {
          Authorization: "Bearer session-token",
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "participant_not_found",
        message: "Participant was not found.",
      },
    });
    expect(response.status).toBe(404);
  });
});
