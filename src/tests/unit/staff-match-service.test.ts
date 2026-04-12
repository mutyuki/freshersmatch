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

import { resolveStaffMatch, startStaffMatch } from "@/lib/services/staff-match-service";

type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];

function createParticipantRow(
  overrides: Partial<ParticipantRow> & Pick<ParticipantRow, "id" | "nickname">,
): ParticipantRow {
  return {
    id: overrides.id,
    event_id: overrides.event_id ?? "event-1",
    nickname: overrides.nickname,
    status: overrides.status ?? "queueing",
    last_non_disconnect_status: overrides.last_non_disconnect_status ?? "queueing",
    chip_balance: overrides.chip_balance ?? 12,
    current_match_id: overrides.current_match_id ?? null,
    last_opponent_participant_id: overrides.last_opponent_participant_id ?? null,
    queued_at: overrides.queued_at ?? "2026-04-13T09:00:00.000Z",
    last_seen_at: overrides.last_seen_at ?? "2026-04-13T09:00:00.000Z",
    disqualified_reason: overrides.disqualified_reason ?? null,
    created_at: overrides.created_at ?? "2026-04-13T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-13T09:00:00.000Z",
  };
}

function createMatchRow(
  overrides: Partial<MatchRow> &
    Pick<MatchRow, "id" | "event_id" | "table_id" | "player1_participant_id" | "status">,
): MatchRow {
  return {
    id: overrides.id,
    event_id: overrides.event_id,
    table_id: overrides.table_id,
    player1_participant_id: overrides.player1_participant_id,
    player2_participant_id: overrides.player2_participant_id ?? null,
    status: overrides.status,
    is_staff_match: overrides.is_staff_match ?? true,
    agreed_bet_amount: overrides.agreed_bet_amount ?? 3,
    started_at: overrides.started_at ?? "2026-04-13T09:05:00.000Z",
    winner_participant_id: overrides.winner_participant_id ?? null,
    winner_claimed_by_participant_id: overrides.winner_claimed_by_participant_id ?? null,
    winner_claimed_at: overrides.winner_claimed_at ?? null,
    completed_at: overrides.completed_at ?? null,
    cancelled_by_participant_id: overrides.cancelled_by_participant_id ?? null,
    staff_operator_id: overrides.staff_operator_id ?? "admin-1",
    player1_ready_at: overrides.player1_ready_at ?? null,
    player2_ready_at: overrides.player2_ready_at ?? null,
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

describe("staff match service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAdminClient.mockReturnValue({ from, rpc });
  });

  it("returns invalidation metadata when starting a staff match", async () => {
    from.mockImplementation((tableName: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data:
              tableName === "participants"
                ? createParticipantRow({ id: "participant-1", nickname: "Alice" })
                : tableName === "tables"
                  ? createTableRow({
                      id: "table-9",
                      event_id: "event-1",
                      table_number: 9,
                      game_title: "SF6",
                    })
                  : createMatchRow({
                      id: "match-1",
                      event_id: "event-1",
                      table_id: "table-9",
                      player1_participant_id: "participant-1",
                      status: "reserved",
                    }),
            error: null,
          }),
        }),
      }),
    }));
    rpc.mockResolvedValue({
      data: [{ match_id: "match-1" }],
      error: null,
    });

    await expect(
      startStaffMatch({
        adminUserId: "admin-1",
        participantId: "participant-1",
        optionalTableId: "table-9",
      }),
    ).resolves.toEqual({
      eventId: "event-1",
      matchId: "match-1",
      tableId: "table-9",
      participantIds: ["participant-1"],
      includeRanking: false,
    });

    expect(rpc).toHaveBeenCalledWith("start_staff_match", {
      p_admin_user_id: "admin-1",
      p_participant_id: "participant-1",
      p_table_id: "table-9",
    });
  });

  it("normalizes start conflicts from the rpc", async () => {
    from.mockImplementation((tableName: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data:
              tableName === "participants"
                ? createParticipantRow({ id: "participant-1", nickname: "Alice" })
                : createTableRow({
                    id: "table-9",
                    event_id: "event-1",
                    table_number: 9,
                    game_title: "SF6",
                  }),
            error: null,
          }),
        }),
      }),
    }));
    rpc.mockResolvedValue({
      data: null,
      error: { message: "No available table found for event: event-1" },
    });

    await expect(
      startStaffMatch({
        adminUserId: "admin-1",
        participantId: "participant-1",
        optionalTableId: "table-9",
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });

  it("returns ranking-aware metadata when resolving a staff match", async () => {
    from.mockImplementation((tableName: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data:
              tableName === "matches"
                ? createMatchRow({
                    id: "match-1",
                    event_id: "event-1",
                    table_id: "table-4",
                    player1_participant_id: "participant-1",
                    status: "in_progress",
                  })
                : null,
            error: null,
          }),
        }),
      }),
    }));
    rpc.mockResolvedValue({
      data: [{ match_status: "completed" }],
      error: null,
    });

    await expect(
      resolveStaffMatch({
        adminUserId: "admin-1",
        matchId: "match-1",
        participantWon: true,
      }),
    ).resolves.toEqual({
      eventId: "event-1",
      matchId: "match-1",
      tableId: "table-4",
      participantIds: ["participant-1"],
      includeRanking: true,
    });
  });

  it("normalizes non-staff-match resolution conflicts", async () => {
    from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: createMatchRow({
              id: "match-1",
              event_id: "event-1",
              table_id: "table-4",
              player1_participant_id: "participant-1",
              status: "in_progress",
              is_staff_match: false,
            }),
            error: null,
          }),
        }),
      }),
    }));
    rpc.mockResolvedValue({
      data: null,
      error: { message: "Match is not a staff match: match-1" },
    });

    await expect(
      resolveStaffMatch({
        adminUserId: "admin-1",
        matchId: "match-1",
        participantWon: false,
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });

  it("raises a not found error when the rpc target match is missing", async () => {
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
      resolveStaffMatch({
        adminUserId: "admin-1",
        matchId: "missing-match",
        participantWon: false,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
