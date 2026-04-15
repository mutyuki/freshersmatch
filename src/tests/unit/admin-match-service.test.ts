import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/types";
import { AppError, DomainConflictError } from "@/lib/domain/errors";

const { getSupabaseAdminClient, from, rpc } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

import {
  forceReleaseTable,
  holdTable,
  listAdminMatches,
  listAdminTables,
  releaseTableHold,
  resolveMatchByAdmin,
  updateTableGameTitle,
} from "@/lib/services/admin-match-service";

type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type AdminUserRow = Database["public"]["Tables"]["admin_users"]["Row"];

function createParticipantRow(
  overrides: Partial<ParticipantRow> & Pick<ParticipantRow, "id" | "nickname">,
): ParticipantRow {
  return {
    id: overrides.id,
    event_id: overrides.event_id ?? "event-1",
    nickname: overrides.nickname,
    status: overrides.status ?? "registered",
    last_non_disconnect_status: overrides.last_non_disconnect_status ?? "registered",
    chip_balance: overrides.chip_balance ?? 10,
    current_match_id: overrides.current_match_id ?? null,
    last_opponent_participant_id: overrides.last_opponent_participant_id ?? null,
    queued_at: overrides.queued_at ?? null,
    last_seen_at: overrides.last_seen_at ?? "2026-04-13T09:00:00.000Z",
    disqualified_reason: overrides.disqualified_reason ?? null,
    created_at: overrides.created_at ?? "2026-04-13T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-13T09:00:00.000Z",
  };
}

function createMatchRow(
  overrides: Partial<MatchRow> &
    Pick<MatchRow, "id" | "event_id" | "player1_participant_id" | "status">,
): MatchRow {
  const isStaffMatch = overrides.is_staff_match ?? false;

  return {
    id: overrides.id,
    event_id: overrides.event_id,
    table_id: overrides.table_id ?? "table-1",
    player1_participant_id: overrides.player1_participant_id,
    player2_participant_id: overrides.player2_participant_id ?? "participant-2",
    status: overrides.status,
    is_staff_match: isStaffMatch,
    agreed_bet_amount: overrides.agreed_bet_amount ?? null,
    started_at: overrides.started_at ?? null,
    winner_participant_id: overrides.winner_participant_id ?? null,
    winner_claimed_by_participant_id: overrides.winner_claimed_by_participant_id ?? null,
    winner_claimed_at: overrides.winner_claimed_at ?? null,
    completed_at: overrides.completed_at ?? null,
    cancelled_by_participant_id: overrides.cancelled_by_participant_id ?? null,
    staff_operator_id: overrides.staff_operator_id ?? null,
    player1_ready_at: overrides.player1_ready_at ?? null,
    player2_ready_at: overrides.player2_ready_at ?? null,
    player1_turn_role: overrides.player1_turn_role ?? (isStaffMatch ? null : "first"),
    player2_turn_role: overrides.player2_turn_role ?? (isStaffMatch ? null : "second"),
    dispute_count: overrides.dispute_count ?? 0,
    last_disputed_at: overrides.last_disputed_at ?? null,
    void_reason: overrides.void_reason ?? null,
    created_at: overrides.created_at ?? "2026-04-13T08:30:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-13T09:00:00.000Z",
  };
}

function createTableRow(
  overrides: Partial<TableRow> & Pick<TableRow, "id" | "event_id" | "table_number" | "game_title">,
): TableRow {
  return {
    id: overrides.id,
    event_id: overrides.event_id,
    table_number: overrides.table_number,
    game_title: overrides.game_title,
    status: overrides.status ?? "available",
    current_match_id: overrides.current_match_id ?? null,
    held_by_admin_user_id: overrides.held_by_admin_user_id ?? null,
    created_at: overrides.created_at ?? "2026-04-13T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-13T09:00:00.000Z",
  };
}

function createAdminUserRow(
  overrides: Partial<AdminUserRow> & Pick<AdminUserRow, "id" | "display_name">,
): AdminUserRow {
  return {
    id: overrides.id,
    display_name: overrides.display_name,
    passcode_hash: overrides.passcode_hash ?? "hash",
    role: overrides.role ?? "staff",
    created_at: overrides.created_at ?? "2026-04-13T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-13T09:00:00.000Z",
  };
}

describe("admin match service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAdminClient.mockReturnValue({ from, rpc });
  });

  it("lists admin matches with fixed display fields and participant ids", async () => {
    const participants = [
      createParticipantRow({ id: "participant-1", nickname: "Alice" }),
      createParticipantRow({ id: "participant-2", nickname: "Bob" }),
    ];
    const matches = [
      createMatchRow({
        id: "match-1",
        event_id: "event-1",
        player1_participant_id: "participant-1",
        player2_participant_id: "participant-2",
        status: "winner_claimed",
        started_at: "2026-04-13T08:40:00.000Z",
        dispute_count: 2,
      }),
    ];
    const tables = [
      createTableRow({
        id: "table-1",
        event_id: "event-1",
        table_number: 3,
        game_title: "Street Fighter 6",
      }),
    ];

    from.mockImplementation((tableName: string) => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({
              data:
                tableName === "participants"
                  ? participants
                  : tableName === "matches"
                    ? matches
                    : tables,
              error: null,
            }),
          }),
        }),
      }),
    }));

    await expect(listAdminMatches("event-1")).resolves.toEqual([
      {
        matchId: "match-1",
        tableNumber: 3,
        status: "winner_claimed",
        participant1Id: "participant-1",
        participant1Nickname: "Alice",
        participant2Id: "participant-2",
        participant2Nickname: "Bob",
        startedAt: "2026-04-13T08:40:00.000Z",
        disputeCount: 2,
      },
    ]);
  });

  it("lists admin tables with occupants and held-by display name", async () => {
    const participants = [
      createParticipantRow({ id: "participant-1", nickname: "Alice" }),
      createParticipantRow({ id: "participant-2", nickname: "Bob" }),
    ];
    const matches = [
      createMatchRow({
        id: "match-1",
        event_id: "event-1",
        player1_participant_id: "participant-1",
        player2_participant_id: "participant-2",
        status: "in_progress",
      }),
    ];
    const tables = [
      createTableRow({
        id: "table-1",
        event_id: "event-1",
        table_number: 1,
        game_title: "Tekken 8",
        status: "admin_hold",
        current_match_id: "match-1",
        held_by_admin_user_id: "admin-1",
      }),
    ];
    const adminUsers = [createAdminUserRow({ id: "admin-1", display_name: "Desk A" })];

    from.mockImplementation((tableName: string) => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({
              data:
                tableName === "participants"
                  ? participants
                  : tableName === "matches"
                    ? matches
                    : tables,
              error: null,
            }),
          }),
        }),
        in: () => ({
          limit: async () => ({
            data: adminUsers,
            error: null,
          }),
        }),
      }),
    }));

    await expect(listAdminTables("event-1")).resolves.toEqual([
      {
        tableId: "table-1",
        tableNumber: 1,
        gameTitle: "Tekken 8",
        status: "admin_hold",
        currentMatchId: "match-1",
        occupantNicknames: ["Alice", "Bob"],
        heldByAdminDisplayName: "Desk A",
      },
    ]);
  });

  it("updates a table game title and returns affected participants", async () => {
    from.mockImplementation((tableName: string) => {
      if (tableName === "tables") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: createTableRow({
                  id: "table-1",
                  event_id: "event-1",
                  table_number: 2,
                  game_title: "SF6",
                  current_match_id: "match-1",
                  status: "in_use",
                }),
                error: null,
              }),
            }),
          }),
          update: (values: { game_title: string }) => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({
                  data: createTableRow({
                    id: "table-1",
                    event_id: "event-1",
                    table_number: 2,
                    game_title: values.game_title,
                    current_match_id: "match-1",
                    status: "in_use",
                  }),
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data:
                tableName === "matches"
                  ? createMatchRow({
                      id: "match-1",
                      event_id: "event-1",
                      player1_participant_id: "participant-1",
                      player2_participant_id: "participant-2",
                      status: "in_progress",
                    })
                  : null,
              error: null,
            }),
          }),
        }),
      };
    });

    await expect(
      updateTableGameTitle({
        tableId: "table-1",
        gameTitle: " Guilty Gear Strive ",
      }),
    ).resolves.toEqual({
      eventId: "event-1",
      matchId: "match-1",
      tableId: "table-1",
      participantIds: ["participant-1", "participant-2"],
      includeRanking: false,
    });
  });

  it("rejects empty game titles when updating a table", async () => {
    await expect(
      updateTableGameTitle({
        tableId: "table-1",
        gameTitle: "   ",
      }),
    ).rejects.toMatchObject({
      code: "table_game_title_required",
      status: 400,
    });

    expect(from).not.toHaveBeenCalled();
  });

  it("returns affected entities for force release and hold actions", async () => {
    from.mockImplementation((tableName: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data:
              tableName === "tables"
                ? createTableRow({
                    id: "table-1",
                    event_id: "event-1",
                    table_number: 2,
                    game_title: "SF6",
                    current_match_id: "match-1",
                    status: "in_use",
                  })
                : createMatchRow({
                    id: "match-1",
                    event_id: "event-1",
                    player1_participant_id: "participant-1",
                    player2_participant_id: "participant-2",
                    status: "in_progress",
                  }),
            error: null,
          }),
        }),
      }),
    }));
    rpc
      .mockResolvedValueOnce({
        data: [
          {
            table_status: "available",
            affected_match_id: "match-1",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ table_status: "admin_hold" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ table_status: "available" }],
        error: null,
      });

    await expect(
      forceReleaseTable({
        adminUserId: "admin-1",
        tableId: "table-1",
      }),
    ).resolves.toEqual({
      eventId: "event-1",
      matchId: "match-1",
      tableId: "table-1",
      participantIds: ["participant-1", "participant-2"],
      includeRanking: false,
    });

    await expect(
      holdTable({
        adminUserId: "admin-1",
        tableId: "table-1",
      }),
    ).resolves.toMatchObject({
      eventId: "event-1",
      tableId: "table-1",
      participantIds: [],
    });

    await expect(
      releaseTableHold({
        adminUserId: "admin-1",
        tableId: "table-1",
      }),
    ).resolves.toMatchObject({
      eventId: "event-1",
      tableId: "table-1",
      participantIds: [],
    });
  });

  it("maps resolve match conflicts and winner metadata", async () => {
    from.mockImplementation((tableName: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data:
              tableName === "matches"
                ? createMatchRow({
                    id: "match-1",
                    event_id: "event-1",
                    player1_participant_id: "participant-1",
                    player2_participant_id: "participant-2",
                    status: "in_progress",
                  })
                : null,
            error: null,
          }),
        }),
      }),
    }));
    rpc
      .mockResolvedValueOnce({
        data: [{ match_status: "force_finished_by_admin" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "Match cannot be force-finished from status: completed",
        },
      });

    await expect(
      resolveMatchByAdmin({
        adminUserId: "admin-1",
        matchId: "match-1",
        resolution: {
          type: "winner",
          winnerParticipantId: "participant-1",
        },
      }),
    ).resolves.toEqual({
      eventId: "event-1",
      matchId: "match-1",
      tableId: "table-1",
      participantIds: ["participant-1", "participant-2"],
      includeRanking: true,
    });

    await expect(
      resolveMatchByAdmin({
        adminUserId: "admin-1",
        matchId: "match-1",
        resolution: {
          type: "winner",
          winnerParticipantId: "participant-1",
        },
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });

  it("maps missing rows to app errors", async () => {
    from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: null,
          }),
        }),
      }),
    }));

    await expect(
      forceReleaseTable({
        adminUserId: "admin-1",
        tableId: "missing-table",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
