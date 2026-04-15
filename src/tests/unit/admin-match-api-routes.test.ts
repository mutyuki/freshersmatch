import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdminSession,
  getActiveEventId,
  listAdminMatches,
  listAdminTables,
  forceReleaseTable,
  holdTable,
  releaseTableHold,
  updateTableGameTitle,
  updateTableRule,
  getAdminTableRule,
  resolveMatchByAdmin,
  startStaffMatch,
  resolveStaffMatch,
  publishInvalidation,
} = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getActiveEventId: vi.fn(),
  listAdminMatches: vi.fn(),
  listAdminTables: vi.fn(),
  forceReleaseTable: vi.fn(),
  holdTable: vi.fn(),
  releaseTableHold: vi.fn(),
  updateTableGameTitle: vi.fn(),
  updateTableRule: vi.fn(),
  getAdminTableRule: vi.fn(),
  resolveMatchByAdmin: vi.fn(),
  startStaffMatch: vi.fn(),
  resolveStaffMatch: vi.fn(),
  publishInvalidation: vi.fn(),
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession,
}));

vi.mock("@/lib/services/admin-dashboard-service", () => ({
  getActiveEventId,
}));

vi.mock("@/lib/services/admin-match-service", () => ({
  listAdminMatches,
  listAdminTables,
  forceReleaseTable,
  holdTable,
  releaseTableHold,
  updateTableGameTitle,
  updateTableRule,
  getAdminTableRule,
  resolveMatchByAdmin,
}));

vi.mock("@/lib/services/staff-match-service", () => ({
  startStaffMatch,
  resolveStaffMatch,
}));

vi.mock("@/lib/realtime/publisher", () => ({
  publishInvalidation,
}));

import { AppError } from "@/lib/domain/errors";
import { GET as getAdminMatches } from "@/app/api/admin/matches/route";
import { POST as resolveMatchPost } from "@/app/api/admin/match/resolve/route";
import { POST as resolveStaffMatchPost } from "@/app/api/admin/staff-match/resolve/route";
import { POST as startStaffMatchPost } from "@/app/api/admin/staff-match/start/route";
import { GET as getAdminTables } from "@/app/api/admin/tables/route";
import { POST as forceReleaseTablePost } from "@/app/api/admin/table/force-release/route";
import { POST as updateTableGameTitlePost } from "@/app/api/admin/table/game-title/route";
import {
  GET as getTableRuleRoute,
  POST as updateTableRulePost,
} from "@/app/api/admin/table/rule/route";
import { POST as holdTablePost } from "@/app/api/admin/table/hold/route";
import { POST as releaseTableHoldPost } from "@/app/api/admin/table/release-hold/route";

describe("admin match and table api routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSession.mockResolvedValue({ adminUserId: "admin-1" });
  });

  it("returns admin matches for SSR refresh", async () => {
    getActiveEventId.mockResolvedValue("event-1");
    listAdminMatches.mockResolvedValue([{ matchId: "match-1" }]);

    const response = await getAdminMatches(new Request("http://localhost/api/admin/matches"));

    await expect(response.json()).resolves.toEqual({
      data: [{ matchId: "match-1" }],
    });
    expect(listAdminMatches).toHaveBeenCalledWith("event-1");
  });

  it("returns admin tables for SSR refresh", async () => {
    listAdminTables.mockResolvedValue([{ tableId: "table-1" }]);

    const response = await getAdminTables(
      new Request("http://localhost/api/admin/tables?eventId=event-9"),
    );

    await expect(response.json()).resolves.toEqual({
      data: [{ tableId: "table-1" }],
    });
    expect(getActiveEventId).not.toHaveBeenCalled();
    expect(listAdminTables).toHaveBeenCalledWith("event-9");
  });

  it("publishes participant, match, admin, and ranking invalidation for winner resolution", async () => {
    resolveMatchByAdmin.mockResolvedValue({
      eventId: "event-1",
      matchId: "match-1",
      tableId: "table-1",
      participantIds: ["participant-1", "participant-2"],
      includeRanking: true,
    });

    const response = await resolveMatchPost(
      new Request("http://localhost/api/admin/match/resolve", {
        method: "POST",
        body: JSON.stringify({
          matchId: "match-1",
          resolutionType: "winner",
          winnerParticipantId: "participant-1",
          confirm: true,
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: { ok: true },
    });
    expect(resolveMatchByAdmin).toHaveBeenCalledWith({
      adminUserId: "admin-1",
      matchId: "match-1",
      resolution: {
        type: "winner",
        winnerParticipantId: "participant-1",
      },
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "match", "admin", "ranking"],
      participantIds: ["participant-1", "participant-2"],
      matchId: "match-1",
      tableId: "table-1",
    });
  });

  it("publishes admin-only invalidation for hold and release hold", async () => {
    holdTable.mockResolvedValue({
      eventId: "event-1",
      matchId: null,
      tableId: "table-1",
      participantIds: [],
      includeRanking: false,
    });
    releaseTableHold.mockResolvedValue({
      eventId: "event-1",
      matchId: null,
      tableId: "table-1",
      participantIds: [],
      includeRanking: false,
    });

    await holdTablePost(
      new Request("http://localhost/api/admin/table/hold", {
        method: "POST",
        body: JSON.stringify({
          tableId: "table-1",
          confirm: true,
        }),
      }),
    );
    await releaseTableHoldPost(
      new Request("http://localhost/api/admin/table/release-hold", {
        method: "POST",
        body: JSON.stringify({
          tableId: "table-1",
          confirm: true,
        }),
      }),
    );

    expect(publishInvalidation).toHaveBeenNthCalledWith(1, {
      eventId: "event-1",
      scopes: ["admin"],
      tableId: "table-1",
    });
    expect(publishInvalidation).toHaveBeenNthCalledWith(2, {
      eventId: "event-1",
      scopes: ["admin"],
      tableId: "table-1",
    });
  });

  it("publishes participant, match, and admin invalidation for table title updates with active match", async () => {
    updateTableGameTitle.mockResolvedValue({
      eventId: "event-1",
      matchId: "match-1",
      tableId: "table-1",
      participantIds: ["participant-1", "participant-2"],
      includeRanking: false,
    });

    await updateTableGameTitlePost(
      new Request("http://localhost/api/admin/table/game-title", {
        method: "POST",
        body: JSON.stringify({
          tableId: "table-1",
          gameTitle: "Tekken 8",
        }),
      }),
    );

    expect(updateTableGameTitle).toHaveBeenCalledWith({
      tableId: "table-1",
      gameTitle: "Tekken 8",
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "match", "admin"],
      participantIds: ["participant-1", "participant-2"],
      matchId: "match-1",
      tableId: "table-1",
    });
  });

  it("returns invalid request for empty table game title payload", async () => {
    const response = await updateTableGameTitlePost(
      new Request("http://localhost/api/admin/table/game-title", {
        method: "POST",
        body: JSON.stringify({
          tableId: "table-1",
          gameTitle: "   ",
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
    expect(updateTableGameTitle).not.toHaveBeenCalled();
    expect(publishInvalidation).not.toHaveBeenCalled();
  });

  it("reads and updates table rules through the admin route", async () => {
    getAdminTableRule.mockResolvedValue({
      id: "rule-1",
      title: "Smash Bros ルール",
      body: "body",
      updatedAt: "2026-04-12T01:15:00.000Z",
    });
    updateTableRule.mockResolvedValue({
      eventId: "event-1",
      matchId: "match-1",
      tableId: "table-1",
      participantIds: ["participant-1", "participant-2"],
      includeRanking: false,
    });

    const getResponse = await getTableRuleRoute(
      new Request("http://localhost/api/admin/table/rule?tableId=table-1"),
    );
    const postResponse = await updateTableRulePost(
      new Request("http://localhost/api/admin/table/rule", {
        method: "POST",
        body: JSON.stringify({
          tableId: "table-1",
          title: "Smash Bros ルール",
          body: "body",
        }),
      }),
    );

    await expect(getResponse.json()).resolves.toEqual({
      data: {
        id: "rule-1",
        title: "Smash Bros ルール",
        body: "body",
        updatedAt: "2026-04-12T01:15:00.000Z",
      },
    });
    await expect(postResponse.json()).resolves.toEqual({
      data: { ok: true },
    });
    expect(getAdminTableRule).toHaveBeenCalledWith("table-1");
    expect(updateTableRule).toHaveBeenCalledWith({
      tableId: "table-1",
      title: "Smash Bros ルール",
      body: "body",
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "match", "admin"],
      participantIds: ["participant-1", "participant-2"],
      matchId: "match-1",
      tableId: "table-1",
    });
  });

  it("publishes participant, match, and admin invalidation for force release when a match is affected", async () => {
    forceReleaseTable.mockResolvedValue({
      eventId: "event-1",
      matchId: "match-1",
      tableId: "table-1",
      participantIds: ["participant-1", "participant-2"],
      includeRanking: false,
    });

    await forceReleaseTablePost(
      new Request("http://localhost/api/admin/table/force-release", {
        method: "POST",
        body: JSON.stringify({
          tableId: "table-1",
          confirm: true,
        }),
      }),
    );

    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "match", "admin"],
      participantIds: ["participant-1", "participant-2"],
      matchId: "match-1",
      tableId: "table-1",
    });
  });

  it("returns confirmation errors as json", async () => {
    const response = await holdTablePost(
      new Request("http://localhost/api/admin/table/hold", {
        method: "POST",
        body: JSON.stringify({
          tableId: "table-1",
          confirm: false,
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "admin_confirmation_required",
        message: "Confirmation is required for admin table actions.",
      },
    });
    expect(response.status).toBe(400);
  });

  it("publishes participant, match, and admin invalidation when starting a staff match", async () => {
    startStaffMatch.mockResolvedValue({
      eventId: "event-1",
      matchId: "match-1",
      tableId: "table-1",
      participantIds: ["participant-1"],
      includeRanking: false,
    });

    const response = await startStaffMatchPost(
      new Request("http://localhost/api/admin/staff-match/start", {
        method: "POST",
        body: JSON.stringify({
          participantId: "participant-1",
          confirm: true,
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: { ok: true, matchId: "match-1" },
    });
    expect(startStaffMatch).toHaveBeenCalledWith({
      adminUserId: "admin-1",
      participantId: "participant-1",
      optionalTableId: undefined,
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "match", "admin"],
      participantIds: ["participant-1"],
      matchId: "match-1",
      tableId: "table-1",
    });
  });

  it("returns a confirmation error for staff match start when confirm is false", async () => {
    const response = await startStaffMatchPost(
      new Request("http://localhost/api/admin/staff-match/start", {
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
        message: "Confirmation is required for admin staff match actions.",
      },
    });
    expect(response.status).toBe(400);
    expect(startStaffMatch).not.toHaveBeenCalled();
  });

  it("publishes ranking invalidation when resolving a staff match", async () => {
    resolveStaffMatch.mockResolvedValue({
      eventId: "event-1",
      matchId: "match-9",
      tableId: "table-2",
      participantIds: ["participant-1"],
      includeRanking: true,
    });

    const response = await resolveStaffMatchPost(
      new Request("http://localhost/api/admin/staff-match/resolve", {
        method: "POST",
        body: JSON.stringify({
          matchId: "match-9",
          participantWon: true,
          confirm: true,
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: { ok: true },
    });
    expect(resolveStaffMatch).toHaveBeenCalledWith({
      adminUserId: "admin-1",
      matchId: "match-9",
      participantWon: true,
    });
    expect(publishInvalidation).toHaveBeenCalledWith({
      eventId: "event-1",
      scopes: ["participant", "match", "admin", "ranking"],
      participantIds: ["participant-1"],
      matchId: "match-9",
      tableId: "table-2",
    });
  });

  it("returns downstream session errors as json", async () => {
    requireAdminSession.mockRejectedValue(
      new AppError("admin_session_missing", "Admin session is required.", 401),
    );

    const response = await getAdminMatches(new Request("http://localhost/api/admin/matches"));

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "admin_session_missing",
        message: "Admin session is required.",
      },
    });
  });
});
