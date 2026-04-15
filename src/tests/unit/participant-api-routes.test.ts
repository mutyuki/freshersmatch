import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  registerParticipant,
  restoreParticipantSession,
  getParticipantRuntimeState,
  getParticipantCurrentRule,
  listParticipantGameRules,
  getParticipantRuleByTableId,
  heartbeatParticipant,
  acknowledgeResultConfirmed,
  touchParticipantSession,
  verifyParticipantSession,
  publishInvalidation,
} = vi.hoisted(() => ({
  registerParticipant: vi.fn(),
  restoreParticipantSession: vi.fn(),
  getParticipantRuntimeState: vi.fn(),
  getParticipantCurrentRule: vi.fn(),
  listParticipantGameRules: vi.fn(),
  getParticipantRuleByTableId: vi.fn(),
  heartbeatParticipant: vi.fn(),
  acknowledgeResultConfirmed: vi.fn(),
  touchParticipantSession: vi.fn(),
  verifyParticipantSession: vi.fn(),
  publishInvalidation: vi.fn(),
}));

vi.mock("@/lib/services/participant-service", () => ({
  registerParticipant,
  restoreParticipantSession,
  getParticipantRuntimeState,
  getParticipantCurrentRule,
  listParticipantGameRules,
  getParticipantRuleByTableId,
  heartbeatParticipant,
}));

vi.mock("@/lib/services/match-service", () => ({
  acknowledgeResultConfirmed,
}));

vi.mock("@/lib/auth/participant-session", () => ({
  touchParticipantSession,
  verifyParticipantSession,
}));

vi.mock("@/lib/realtime/publisher", () => ({
  publishInvalidation,
}));

import { AppError } from "@/lib/domain/errors";
import { POST as heartbeatParticipantPost } from "@/app/api/participant/heartbeat/route";
import { GET as getParticipantCurrentRuleRoute } from "@/app/api/participant/current-rule/route";
import { GET as getParticipantMe } from "@/app/api/participant/me/route";
import { GET as getParticipantRulesRoute } from "@/app/api/participant/rules/route";
import { POST as acknowledgeResultPost } from "@/app/api/participant/result/ack/route";
import { POST as registerParticipantPost } from "@/app/api/participant/register/route";
import { POST as restoreParticipantSessionPost } from "@/app/api/participant/session/restore/route";

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

  it("returns wrapped data for participant session restore", async () => {
    restoreParticipantSession.mockResolvedValue({
      runtimeState: {
        participantId: "participant-1",
        eventId: "event-1",
        nickname: "Alice",
        status: "playing",
        lastNonDisconnectStatus: "playing",
        chipBalance: 500,
        currentMatchId: "match-1",
        queuedAt: null,
        table: null,
        match: null,
        opponent: null,
        turnRole: null,
        opponentReady: false,
        winnerParticipantId: null,
        winnerClaimedByParticipantId: null,
        disqualifiedReason: null,
        resultDelta: null,
        resultConfirmedAt: null,
        canStartMatching: false,
        canClaimWin: true,
      },
      restoredConnection: false,
    });

    const response = await restoreParticipantSessionPost(
      new Request("http://localhost/api/participant/session/restore", {
        method: "POST",
        body: JSON.stringify({
          sessionToken: "session-token",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(restoreParticipantSession).toHaveBeenCalledWith({
      sessionToken: "session-token",
    });
    expect(publishInvalidation).not.toHaveBeenCalled();
  });

  it("publishes invalidation only when restore also revives a disconnected participant", async () => {
    restoreParticipantSession.mockResolvedValue({
      runtimeState: {
        participantId: "participant-1",
        eventId: "event-1",
        nickname: "Alice",
        status: "playing",
        lastNonDisconnectStatus: "playing",
        chipBalance: 500,
        currentMatchId: "match-1",
        queuedAt: null,
        table: null,
        match: null,
        opponent: null,
        turnRole: null,
        opponentReady: false,
        winnerParticipantId: null,
        winnerClaimedByParticipantId: null,
        disqualifiedReason: null,
        resultDelta: null,
        resultConfirmedAt: null,
        canStartMatching: false,
        canClaimWin: true,
      },
      restoredConnection: true,
    });

    const response = await restoreParticipantSessionPost(
      new Request("http://localhost/api/participant/session/restore", {
        method: "POST",
        body: JSON.stringify({
          sessionToken: "session-token",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "match", "admin"],
      participantIds: ["participant-1"],
      matchId: "match-1",
      tableId: null,
    });
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
      turnRole: null,
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

  it("returns current rule data for the active table", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    touchParticipantSession.mockResolvedValue(undefined);
    getParticipantCurrentRule.mockResolvedValue({
      tableId: "table-1",
      tableNumber: 3,
      gameTitle: "Smash Bros",
      rule: {
        id: "rule-1",
        title: "Smash Bros ルール",
        body: "対戦ルール本文",
        updatedAt: "2026-04-12T01:15:00.000Z",
      },
    });

    const response = await getParticipantCurrentRuleRoute(
      new Request("http://localhost/api/participant/current-rule", {
        method: "GET",
        headers: {
          Authorization: "Bearer session-token",
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
        tableId: "table-1",
        tableNumber: 3,
        gameTitle: "Smash Bros",
        rule: {
          id: "rule-1",
          title: "Smash Bros ルール",
          body: "対戦ルール本文",
          updatedAt: "2026-04-12T01:15:00.000Z",
        },
      },
    });
    expect(getParticipantCurrentRule).toHaveBeenCalledWith("participant-1");
  });

  it("returns rule list or a specific table rule from participant rules route", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    touchParticipantSession.mockResolvedValue(undefined);
    listParticipantGameRules.mockResolvedValue([
      {
        tableId: "table-1",
        tableNumber: 1,
        gameTitle: "Tekken 8",
        ruleTitle: "鉄拳ルール",
      },
    ]);
    getParticipantRuleByTableId.mockResolvedValue({
      tableId: "table-1",
      tableNumber: 1,
      gameTitle: "Tekken 8",
      rule: {
        id: "rule-1",
        title: "鉄拳ルール",
        body: "body",
        updatedAt: "2026-04-12T01:15:00.000Z",
      },
    });

    const listResponse = await getParticipantRulesRoute(
      new Request("http://localhost/api/participant/rules", {
        method: "GET",
        headers: {
          Authorization: "Bearer session-token",
        },
      }),
    );
    const detailResponse = await getParticipantRulesRoute(
      new Request("http://localhost/api/participant/rules?tableId=table-1", {
        method: "GET",
        headers: {
          Authorization: "Bearer session-token",
        },
      }),
    );

    await expect(listResponse.json()).resolves.toEqual({
      data: [
        {
          tableId: "table-1",
          tableNumber: 1,
          gameTitle: "Tekken 8",
          ruleTitle: "鉄拳ルール",
        },
      ],
    });
    await expect(detailResponse.json()).resolves.toEqual({
      data: {
        tableId: "table-1",
        tableNumber: 1,
        gameTitle: "Tekken 8",
        rule: {
          id: "rule-1",
          title: "鉄拳ルール",
          body: "body",
          updatedAt: "2026-04-12T01:15:00.000Z",
        },
      },
    });
    expect(listParticipantGameRules).toHaveBeenCalledWith("participant-1");
    expect(getParticipantRuleByTableId).toHaveBeenCalledWith("participant-1", "table-1");
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

  it("acknowledges a confirmed result without parsing a body", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    acknowledgeResultConfirmed.mockResolvedValue({
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
      turnRole: null,
      opponentReady: false,
      winnerParticipantId: null,
      winnerClaimedByParticipantId: null,
      disqualifiedReason: null,
      resultDelta: null,
      resultConfirmedAt: null,
      canStartMatching: true,
      canClaimWin: false,
    });
    publishInvalidation.mockResolvedValue(undefined);

    const response = await acknowledgeResultPost(
      new Request("http://localhost/api/participant/result/ack", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
        },
        body: "{",
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
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
        turnRole: null,
        opponentReady: false,
        winnerParticipantId: null,
        winnerClaimedByParticipantId: null,
        disqualifiedReason: null,
        resultDelta: null,
        resultConfirmedAt: null,
        canStartMatching: true,
        canClaimWin: false,
      },
    });
    expect(response.status).toBe(200);
    expect(verifyParticipantSession).toHaveBeenCalledWith("session-token");
    expect(acknowledgeResultConfirmed).toHaveBeenCalledWith({
      participantId: "participant-1",
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "admin", "ranking"],
      participantIds: ["participant-1"],
    });
  });

  it("returns a 401 json error when the bearer token is missing for result ack", async () => {
    const response = await acknowledgeResultPost(
      new Request("http://localhost/api/participant/result/ack", {
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
    expect(publishInvalidation).not.toHaveBeenCalled();
  });

  it("returns downstream app errors from result ack as json", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    acknowledgeResultConfirmed.mockRejectedValue(
      new AppError(
        "participant_status_conflict",
        "Participant cannot acknowledge the result from the current state.",
        409,
      ),
    );

    const response = await acknowledgeResultPost(
      new Request("http://localhost/api/participant/result/ack", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "participant_status_conflict",
        message: "Participant cannot acknowledge the result from the current state.",
      },
    });
    expect(response.status).toBe(409);
    expect(publishInvalidation).not.toHaveBeenCalled();
  });
});
