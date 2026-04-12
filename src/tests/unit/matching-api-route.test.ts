import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyParticipantSession, executeStartQueue, executeCancelQueue, publishInvalidation } =
  vi.hoisted(() => ({
    verifyParticipantSession: vi.fn(),
    executeStartQueue: vi.fn(),
    executeCancelQueue: vi.fn(),
    publishInvalidation: vi.fn(),
  }));

vi.mock("@/lib/auth/participant-session", () => ({
  verifyParticipantSession,
}));

vi.mock("@/lib/services/matching-service", () => ({
  executeStartQueue,
  executeCancelQueue,
}));

vi.mock("@/lib/realtime/publisher", () => ({
  publishInvalidation,
}));

import { AppError } from "@/lib/domain/errors";
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
});
