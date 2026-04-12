import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminSession,
  getActiveEventId,
  listAdminParticipants,
  adjustParticipantChip,
  pauseParticipant,
  unpauseParticipant,
  disqualifyParticipant,
  publishInvalidation,
} = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getActiveEventId: vi.fn(),
  listAdminParticipants: vi.fn(),
  adjustParticipantChip: vi.fn(),
  pauseParticipant: vi.fn(),
  unpauseParticipant: vi.fn(),
  disqualifyParticipant: vi.fn(),
  publishInvalidation: vi.fn(),
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession,
}));

vi.mock("@/lib/services/admin-dashboard-service", () => ({
  getActiveEventId,
}));

vi.mock("@/lib/services/admin-participant-service", () => ({
  listAdminParticipants,
  adjustParticipantChip,
  pauseParticipant,
  unpauseParticipant,
  disqualifyParticipant,
}));

vi.mock("@/lib/realtime/publisher", () => ({
  publishInvalidation,
}));

import { AppError } from "@/lib/domain/errors";
import { GET as getAdminParticipants } from "@/app/api/admin/participants/route";
import { POST as postChipAdjust } from "@/app/api/admin/participant/chip-adjust/route";
import { POST as postPause } from "@/app/api/admin/participant/pause/route";
import { POST as postUnpause } from "@/app/api/admin/participant/unpause/route";
import { POST as postDisqualify } from "@/app/api/admin/participant/disqualify/route";

describe("admin participant api routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the participants list after validating the admin session", async () => {
    requireAdminSession.mockResolvedValue({
      adminUserId: "admin-1",
    });
    getActiveEventId.mockResolvedValue("event-1");
    listAdminParticipants.mockResolvedValue([
      {
        participantId: "participant-1",
        nickname: "Alice",
        status: "registered",
        chipBalance: 12,
        currentMatchId: null,
        lastSeenAt: "2026-04-13T09:00:00.000Z",
        disqualifiedReason: null,
      },
    ]);

    const response = await getAdminParticipants(
      new Request("http://localhost/api/admin/participants"),
    );

    await expect(response.json()).resolves.toEqual({
      data: [
        {
          participantId: "participant-1",
          nickname: "Alice",
          status: "registered",
          chipBalance: 12,
          currentMatchId: null,
          lastSeenAt: "2026-04-13T09:00:00.000Z",
          disqualifiedReason: null,
        },
      ],
    });
    expect(getActiveEventId).toHaveBeenCalledTimes(1);
    expect(listAdminParticipants).toHaveBeenCalledWith("event-1");
  });

  it("uses the requested event id for participant refresh", async () => {
    requireAdminSession.mockResolvedValue({
      adminUserId: "admin-1",
    });
    listAdminParticipants.mockResolvedValue([]);

    const response = await getAdminParticipants(
      new Request("http://localhost/api/admin/participants?eventId=event-9"),
    );

    expect(response.status).toBe(200);
    expect(getActiveEventId).not.toHaveBeenCalled();
    expect(listAdminParticipants).toHaveBeenCalledWith("event-9");
  });

  it("publishes participant, admin, and ranking invalidation for chip adjust", async () => {
    requireAdminSession.mockResolvedValue({
      adminUserId: "admin-1",
    });
    adjustParticipantChip.mockResolvedValue({
      eventId: "event-1",
      participantId: "participant-1",
    });

    const response = await postChipAdjust(
      new Request("http://localhost/api/admin/participant/chip-adjust", {
        method: "POST",
        body: JSON.stringify({
          participantId: "participant-1",
          delta: 5,
          reason: "manual correction",
          confirm: true,
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
        ok: true,
      },
    });
    expect(adjustParticipantChip).toHaveBeenCalledWith({
      adminUserId: "admin-1",
      participantId: "participant-1",
      delta: 5,
      reason: "manual correction",
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "admin", "ranking"],
      participantIds: ["participant-1"],
    });
  });

  it("rejects mutation routes when confirmation is missing", async () => {
    const response = await postPause(
      new Request("http://localhost/api/admin/participant/pause", {
        method: "POST",
        body: JSON.stringify({
          participantId: "participant-1",
          confirm: false,
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "admin_confirmation_required",
        message: "Confirmation is required for admin participant actions.",
      },
    });
    expect(requireAdminSession).not.toHaveBeenCalled();
  });

  it("publishes the affected match id for pause and disqualify flows", async () => {
    requireAdminSession.mockResolvedValue({
      adminUserId: "admin-1",
    });
    pauseParticipant.mockResolvedValue({
      eventId: "event-1",
      participantId: "participant-1",
      affectedMatchId: "match-1",
    });
    disqualifyParticipant.mockResolvedValue({
      eventId: "event-1",
      participantId: "participant-1",
      affectedMatchId: "match-1",
    });

    const pauseResponse = await postPause(
      new Request("http://localhost/api/admin/participant/pause", {
        method: "POST",
        body: JSON.stringify({
          participantId: "participant-1",
          confirm: true,
        }),
      }),
    );
    const disqualifyResponse = await postDisqualify(
      new Request("http://localhost/api/admin/participant/disqualify", {
        method: "POST",
        body: JSON.stringify({
          participantId: "participant-1",
          mode: "lose_current_match",
          reason: "rule violation",
          confirm: true,
        }),
      }),
    );

    expect(pauseResponse.status).toBe(200);
    expect(disqualifyResponse.status).toBe(200);
    expect(publishInvalidation).toHaveBeenNthCalledWith(1, {
      eventId: "event-1",
      scopes: ["participant", "admin"],
      participantIds: ["participant-1"],
      matchId: "match-1",
    });
    expect(publishInvalidation).toHaveBeenNthCalledWith(2, {
      eventId: "event-1",
      scopes: ["participant", "admin"],
      participantIds: ["participant-1"],
      matchId: "match-1",
    });
  });

  it("unpauses participants and returns downstream session errors as json", async () => {
    requireAdminSession.mockRejectedValue(
      new AppError("admin_session_missing", "Admin session is required.", 401),
    );

    const response = await postUnpause(
      new Request("http://localhost/api/admin/participant/unpause", {
        method: "POST",
        body: JSON.stringify({
          participantId: "participant-1",
          confirm: true,
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "admin_session_missing",
        message: "Admin session is required.",
      },
    });
    expect(unpauseParticipant).not.toHaveBeenCalled();
  });
});
