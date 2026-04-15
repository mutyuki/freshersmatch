import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyParticipantSession,
  executeStartQueue,
  executeCancelQueue,
  executeReadyMatch,
  executeCancelBeforeStart,
  executeClaimWin,
  executeCancelClaimWin,
  executeApproveResult,
  publishInvalidation,
} = vi.hoisted(() => ({
  verifyParticipantSession: vi.fn(),
  executeStartQueue: vi.fn(),
  executeCancelQueue: vi.fn(),
  executeReadyMatch: vi.fn(),
  executeCancelBeforeStart: vi.fn(),
  executeClaimWin: vi.fn(),
  executeCancelClaimWin: vi.fn(),
  executeApproveResult: vi.fn(),
  publishInvalidation: vi.fn(),
}));

vi.mock("@/lib/auth/participant-session", () => ({
  verifyParticipantSession,
}));

vi.mock("@/lib/services/matching-service", () => ({
  executeStartQueue,
  executeCancelQueue,
}));

vi.mock("@/lib/services/match-service", () => ({
  executeReadyMatch,
  executeCancelBeforeStart,
  executeClaimWin,
  executeCancelClaimWin,
  executeApproveResult,
}));

vi.mock("@/lib/realtime/publisher", () => ({
  publishInvalidation,
}));

import { AppError } from "@/lib/domain/errors";
import { POST as approveResultPost } from "@/app/api/match/approve-result/route";
import { POST as cancelClaimPost } from "@/app/api/match/cancel-claim/route";
import { POST as cancelBeforeStartPost } from "@/app/api/match/cancel-before-start/route";
import { POST as claimWinPost } from "@/app/api/match/claim-win/route";
import { POST as readyMatchPost } from "@/app/api/match/ready/route";
import { POST as cancelMatchingPost } from "@/app/api/matching/cancel/route";
import { POST as startMatchingPost } from "@/app/api/matching/start/route";

describe("matching api routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a 401 json error when the bearer token is missing for start", async () => {
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

  it("starts matching with bearer authorization, publishes invalidation, and returns runtime data", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeStartQueue.mockResolvedValue({
      participantId: "participant-1",
      eventId: "event-1",
      status: "queueing",
    });
    publishInvalidation.mockResolvedValue(undefined);

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
        eventId: "event-1",
        status: "queueing",
      },
    });
    expect(response.status).toBe(200);
    expect(verifyParticipantSession).toHaveBeenCalledWith("session-token");
    expect(executeStartQueue).toHaveBeenCalledWith({
      participantId: "participant-1",
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "admin"],
      participantIds: ["participant-1"],
      matchId: undefined,
      tableId: null,
    });
  });

  it("publishes invalidation for both participants and the match when a table is assigned", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeStartQueue.mockResolvedValue({
      participantId: "participant-1",
      eventId: "event-1",
      status: "match_reserved",
      currentMatchId: "match-1",
      table: {
        id: "table-1",
        tableNumber: 2,
        gameTitle: "Smash Bros",
        ruleId: "rule-1",
        status: "reserved",
      },
      opponent: {
        participantId: "participant-2",
        nickname: "Bob",
      },
    });
    publishInvalidation.mockResolvedValue(undefined);

    const response = await startMatchingPost(
      new Request("http://localhost/api/matching/start", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "match", "admin"],
      participantIds: ["participant-1", "participant-2"],
      matchId: "match-1",
      tableId: "table-1",
    });
  });

  it("returns downstream app errors from start as json", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeStartQueue.mockRejectedValue(
      new AppError(
        "participant_status_conflict",
        "Participant must be registered before starting matching.",
        409,
      ),
    );

    const response = await startMatchingPost(
      new Request("http://localhost/api/matching/start", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "participant_status_conflict",
        message: "Participant must be registered before starting matching.",
      },
    });
    expect(response.status).toBe(409);
    expect(publishInvalidation).not.toHaveBeenCalled();
  });

  it("returns a 401 json error when the bearer token is missing for cancel", async () => {
    const response = await cancelMatchingPost(
      new Request("http://localhost/api/matching/cancel", {
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

  it("cancels queueing with bearer authorization, publishes invalidation, and returns runtime data", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeCancelQueue.mockResolvedValue({
      participantId: "participant-1",
      eventId: "event-1",
      status: "registered",
    });
    publishInvalidation.mockResolvedValue(undefined);

    const response = await cancelMatchingPost(
      new Request("http://localhost/api/matching/cancel", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
        participantId: "participant-1",
        eventId: "event-1",
        status: "registered",
      },
    });
    expect(response.status).toBe(200);
    expect(verifyParticipantSession).toHaveBeenCalledWith("session-token");
    expect(executeCancelQueue).toHaveBeenCalledWith({
      participantId: "participant-1",
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "admin"],
      participantIds: ["participant-1"],
    });
  });

  it("returns downstream app errors from cancel as json", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeCancelQueue.mockRejectedValue(
      new AppError(
        "participant_status_conflict",
        "Participant must be queueing before cancelling matching.",
        409,
      ),
    );

    const response = await cancelMatchingPost(
      new Request("http://localhost/api/matching/cancel", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "participant_status_conflict",
        message: "Participant must be queueing before cancelling matching.",
      },
    });
    expect(response.status).toBe(409);
    expect(publishInvalidation).not.toHaveBeenCalled();
  });

  it("returns a 401 json error when the bearer token is missing for ready", async () => {
    const response = await readyMatchPost(
      new Request("http://localhost/api/match/ready", {
        method: "POST",
        body: JSON.stringify({
          matchId: "match-1",
        }),
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

  it("returns a 400 json error when ready request validation fails", async () => {
    const response = await readyMatchPost(
      new Request("http://localhost/api/match/ready", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({}),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_request",
        message: "Request validation failed.",
      },
    });
    expect(response.status).toBe(400);
    expect(verifyParticipantSession).not.toHaveBeenCalled();
    expect(publishInvalidation).not.toHaveBeenCalled();
  });

  it("readies a match with bearer authorization, publishes invalidation, and returns runtime data", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeReadyMatch.mockResolvedValue({
      participantId: "participant-1",
      eventId: "event-1",
      status: "ready",
    });
    publishInvalidation.mockResolvedValue(undefined);

    const response = await readyMatchPost(
      new Request("http://localhost/api/match/ready", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({
          matchId: "match-1",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
        participantId: "participant-1",
        eventId: "event-1",
        status: "ready",
      },
    });
    expect(response.status).toBe(200);
    expect(verifyParticipantSession).toHaveBeenCalledWith("session-token");
    expect(executeReadyMatch).toHaveBeenCalledWith({
      participantId: "participant-1",
      matchId: "match-1",
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "match", "admin"],
      participantIds: ["participant-1"],
      matchId: "match-1",
    });
  });

  it("returns downstream app errors from ready as json", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeReadyMatch.mockRejectedValue(
      new AppError(
        "match_ready_conflict",
        "Participant cannot ready this match from the current state.",
        409,
      ),
    );

    const response = await readyMatchPost(
      new Request("http://localhost/api/match/ready", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({
          matchId: "match-1",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "match_ready_conflict",
        message: "Participant cannot ready this match from the current state.",
      },
    });
    expect(response.status).toBe(409);
    expect(publishInvalidation).not.toHaveBeenCalled();
  });

  it("cancels before start, publishes invalidation, and returns ok", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeCancelBeforeStart.mockResolvedValue({
      participantId: "participant-1",
      eventId: "event-1",
      status: "registered",
    });
    publishInvalidation.mockResolvedValue(undefined);

    const response = await cancelBeforeStartPost(
      new Request("http://localhost/api/match/cancel-before-start", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({
          matchId: "match-1",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
        ok: true,
      },
    });
    expect(response.status).toBe(200);
    expect(executeCancelBeforeStart).toHaveBeenCalledWith({
      participantId: "participant-1",
      matchId: "match-1",
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "match", "admin"],
      participantIds: ["participant-1"],
      matchId: "match-1",
    });
  });

  it("returns a 400 json error when cancel-before-start request validation fails", async () => {
    const response = await cancelBeforeStartPost(
      new Request("http://localhost/api/match/cancel-before-start", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({}),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_request",
        message: "Request validation failed.",
      },
    });
    expect(response.status).toBe(400);
    expect(verifyParticipantSession).not.toHaveBeenCalled();
  });

  it("returns downstream app errors from cancel-before-start as json", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeCancelBeforeStart.mockRejectedValue(
      new AppError(
        "match_cancel_conflict",
        "Match cannot be cancelled before start from the current state.",
        409,
      ),
    );

    const response = await cancelBeforeStartPost(
      new Request("http://localhost/api/match/cancel-before-start", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({
          matchId: "match-1",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "match_cancel_conflict",
        message: "Match cannot be cancelled before start from the current state.",
      },
    });
    expect(response.status).toBe(409);
    expect(publishInvalidation).not.toHaveBeenCalled();
  });

  it("claims a win, publishes invalidation, and returns runtime data", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeClaimWin.mockResolvedValue({
      participantId: "participant-1",
      eventId: "event-1",
      status: "claiming_win",
    });
    publishInvalidation.mockResolvedValue(undefined);

    const response = await claimWinPost(
      new Request("http://localhost/api/match/claim-win", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({
          matchId: "match-1",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
        participantId: "participant-1",
        eventId: "event-1",
        status: "claiming_win",
      },
    });
    expect(response.status).toBe(200);
    expect(executeClaimWin).toHaveBeenCalledWith({
      participantId: "participant-1",
      matchId: "match-1",
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "match", "admin"],
      participantIds: ["participant-1"],
      matchId: "match-1",
    });
  });

  it("returns a 400 json error when claim-win request validation fails", async () => {
    const response = await claimWinPost(
      new Request("http://localhost/api/match/claim-win", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({}),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_request",
        message: "Request validation failed.",
      },
    });
    expect(response.status).toBe(400);
    expect(verifyParticipantSession).not.toHaveBeenCalled();
  });

  it("returns downstream app errors from claim-win as json", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeClaimWin.mockRejectedValue(
      new AppError(
        "match_claim_conflict",
        "Participant cannot claim a win for this match from the current state.",
        409,
      ),
    );

    const response = await claimWinPost(
      new Request("http://localhost/api/match/claim-win", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({
          matchId: "match-1",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "match_claim_conflict",
        message: "Participant cannot claim a win for this match from the current state.",
      },
    });
    expect(response.status).toBe(409);
    expect(publishInvalidation).not.toHaveBeenCalled();
  });

  it("cancels a win claim, publishes invalidation, and returns runtime data", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeCancelClaimWin.mockResolvedValue({
      participantId: "participant-1",
      eventId: "event-1",
      status: "playing",
    });
    publishInvalidation.mockResolvedValue(undefined);

    const response = await cancelClaimPost(
      new Request("http://localhost/api/match/cancel-claim", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({
          matchId: "match-1",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
        participantId: "participant-1",
        eventId: "event-1",
        status: "playing",
      },
    });
    expect(response.status).toBe(200);
    expect(executeCancelClaimWin).toHaveBeenCalledWith({
      participantId: "participant-1",
      matchId: "match-1",
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "match", "admin"],
      participantIds: ["participant-1"],
      matchId: "match-1",
    });
  });

  it("returns downstream app errors from cancel-claim as json", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeCancelClaimWin.mockRejectedValue(
      new AppError(
        "match_cancel_claim_conflict",
        "Winner claim cannot be cancelled from the current state.",
        409,
      ),
    );

    const response = await cancelClaimPost(
      new Request("http://localhost/api/match/cancel-claim", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({
          matchId: "match-1",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "match_cancel_claim_conflict",
        message: "Winner claim cannot be cancelled from the current state.",
      },
    });
    expect(response.status).toBe(409);
    expect(publishInvalidation).not.toHaveBeenCalled();
  });

  it("approves a result, publishes invalidation, and returns runtime data", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeApproveResult.mockResolvedValue({
      participantId: "participant-1",
      eventId: "event-1",
      status: "result_confirmed",
    });
    publishInvalidation.mockResolvedValue(undefined);

    const response = await approveResultPost(
      new Request("http://localhost/api/match/approve-result", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({
          matchId: "match-1",
          approve: true,
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
        participantId: "participant-1",
        eventId: "event-1",
        status: "result_confirmed",
      },
    });
    expect(response.status).toBe(200);
    expect(executeApproveResult).toHaveBeenCalledWith({
      participantId: "participant-1",
      matchId: "match-1",
      approve: true,
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "match", "admin", "ranking"],
      participantIds: ["participant-1"],
      matchId: "match-1",
    });
  });

  it("passes approve=false through to the service", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeApproveResult.mockResolvedValue({
      participantId: "participant-1",
      eventId: "event-1",
      status: "playing",
    });
    publishInvalidation.mockResolvedValue(undefined);

    const response = await approveResultPost(
      new Request("http://localhost/api/match/approve-result", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({
          matchId: "match-1",
          approve: false,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(executeApproveResult).toHaveBeenCalledWith({
      participantId: "participant-1",
      matchId: "match-1",
      approve: false,
    });
  });

  it("returns a 400 json error when approve-result request validation fails", async () => {
    const response = await approveResultPost(
      new Request("http://localhost/api/match/approve-result", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({
          matchId: "match-1",
          approve: "yes",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_request",
        message: "Request validation failed.",
      },
    });
    expect(response.status).toBe(400);
    expect(verifyParticipantSession).not.toHaveBeenCalled();
  });

  it("returns downstream app errors from approve-result as json", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    executeApproveResult.mockRejectedValue(
      new AppError(
        "match_approval_conflict",
        "Match result cannot be approved from the current state.",
        409,
      ),
    );

    const response = await approveResultPost(
      new Request("http://localhost/api/match/approve-result", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
        body: JSON.stringify({
          matchId: "match-1",
          approve: true,
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "match_approval_conflict",
        message: "Match result cannot be approved from the current state.",
      },
    });
    expect(response.status).toBe(409);
    expect(publishInvalidation).not.toHaveBeenCalled();
  });
});
