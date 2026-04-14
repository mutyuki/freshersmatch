import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/types";

const { getSupabaseAdminClient, normalizeParticipantConnectionState, from } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  normalizeParticipantConnectionState: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

vi.mock("@/lib/services/connection-state-service", () => ({
  normalizeParticipantConnectionState,
}));

import { getActiveEventId, getAdminDashboardData } from "@/lib/services/admin-dashboard-service";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type AdminUserRow = Database["public"]["Tables"]["admin_users"]["Row"];

function createEventRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "event-1",
    name: "Freshers Match",
    venue_code: "VENUE-1",
    initial_chip_balance: 15,
    fixed_bet_amount: 3,
    staff_match_wait_seconds: 180,
    disconnect_threshold_seconds: 45,
    status: "active",
    created_at: "2026-04-13T08:00:00.000Z",
    updated_at: "2026-04-13T08:00:00.000Z",
    ...overrides,
  };
}

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

function createTableRow(
  overrides: Partial<TableRow> & Pick<TableRow, "id" | "table_number" | "game_title" | "status">,
): TableRow {
  return {
    id: overrides.id,
    event_id: overrides.event_id ?? "event-1",
    table_number: overrides.table_number,
    game_title: overrides.game_title,
    status: overrides.status,
    current_match_id: overrides.current_match_id ?? null,
    held_by_admin_user_id: overrides.held_by_admin_user_id ?? null,
    created_at: overrides.created_at ?? "2026-04-13T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-13T09:00:00.000Z",
  };
}

function createMatchRow(
  overrides: Partial<MatchRow> &
    Pick<MatchRow, "id" | "table_id" | "player1_participant_id" | "status">,
): MatchRow {
  const isStaffMatch = overrides.is_staff_match ?? false;

  return {
    id: overrides.id,
    event_id: overrides.event_id ?? "event-1",
    table_id: overrides.table_id,
    player1_participant_id: overrides.player1_participant_id,
    player2_participant_id: overrides.player2_participant_id ?? null,
    status: overrides.status,
    is_staff_match: isStaffMatch,
    staff_operator_id: overrides.staff_operator_id ?? null,
    player1_ready_at: overrides.player1_ready_at ?? null,
    player2_ready_at: overrides.player2_ready_at ?? null,
    player1_turn_role: overrides.player1_turn_role ?? (isStaffMatch ? null : "first"),
    player2_turn_role: overrides.player2_turn_role ?? (isStaffMatch ? null : "second"),
    started_at: overrides.started_at ?? null,
    agreed_bet_amount: overrides.agreed_bet_amount ?? null,
    dispute_count: overrides.dispute_count ?? 0,
    last_disputed_at: overrides.last_disputed_at ?? null,
    winner_participant_id: overrides.winner_participant_id ?? null,
    winner_claimed_by_participant_id: overrides.winner_claimed_by_participant_id ?? null,
    winner_claimed_at: overrides.winner_claimed_at ?? null,
    completed_at: overrides.completed_at ?? null,
    cancelled_by_participant_id: overrides.cancelled_by_participant_id ?? null,
    void_reason: overrides.void_reason ?? null,
    created_at: overrides.created_at ?? "2026-04-13T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-13T09:00:00.000Z",
  };
}

function createAdminUserRow(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: "admin-1",
    display_name: "Desk Lead",
    passcode_hash: "hash",
    role: "admin",
    created_at: "2026-04-13T08:00:00.000Z",
    updated_at: "2026-04-13T08:00:00.000Z",
    ...overrides,
  };
}

describe("admin dashboard service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2026-04-13T09:12:00.000Z"));
    normalizeParticipantConnectionState.mockResolvedValue(undefined);
  });

  it("returns the active event id", async () => {
    from.mockImplementation((tableName: string) => {
      if (tableName === "events") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: createEventRow(),
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${tableName}`);
    });

    getSupabaseAdminClient.mockReturnValue({ from });

    await expect(getActiveEventId()).resolves.toBe("event-1");
  });

  it("aggregates dashboard sections and normalizes disconnect state before reloading participants", async () => {
    const participants = [
      createParticipantRow({
        id: "participant-1",
        nickname: "Alice",
        status: "queueing",
        queued_at: "2026-04-13T09:00:00.000Z",
        chip_balance: 14,
      }),
      createParticipantRow({
        id: "participant-2",
        nickname: "Bob",
        status: "disconnected",
        last_non_disconnect_status: "playing",
        current_match_id: "match-1",
        last_seen_at: "2026-04-13T09:07:00.000Z",
      }),
      createParticipantRow({
        id: "participant-3",
        nickname: "Carol",
        status: "playing",
        current_match_id: "match-1",
      }),
    ];

    const tables = [
      createTableRow({
        id: "table-1",
        table_number: 1,
        game_title: "Smash Bros",
        status: "admin_hold",
        current_match_id: "match-1",
        held_by_admin_user_id: "admin-1",
      }),
    ];

    const matches = [
      createMatchRow({
        id: "match-1",
        table_id: "table-1",
        player1_participant_id: "participant-2",
        player2_participant_id: "participant-3",
        status: "winner_claimed",
        started_at: "2026-04-13T09:02:00.000Z",
        dispute_count: 2,
        last_disputed_at: "2026-04-13T09:08:00.000Z",
        winner_claimed_at: "2026-04-13T09:08:30.000Z",
      }),
    ];

    from.mockImplementation((tableName: string) => {
      if (tableName === "participants") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: participants,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (tableName === "tables") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: tables,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (tableName === "matches") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: matches,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (tableName === "admin_users") {
        return {
          select: () => ({
            in: () => ({
              limit: async () => ({
                data: [createAdminUserRow()],
                error: null,
              }),
            }),
          }),
        };
      }

      if (tableName === "events") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: createEventRow(),
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${tableName}`);
    });

    getSupabaseAdminClient.mockReturnValue({ from });

    await expect(getAdminDashboardData("event-1")).resolves.toEqual({
      eventId: "event-1",
      tables: [
        {
          tableId: "table-1",
          tableNumber: 1,
          gameTitle: "Smash Bros",
          status: "admin_hold",
          currentMatchId: "match-1",
          occupantNicknames: ["Bob", "Carol"],
          heldByAdminDisplayName: "Desk Lead",
        },
      ],
      queueingParticipants: [
        {
          participantId: "participant-1",
          nickname: "Alice",
          queuedAt: "2026-04-13T09:00:00.000Z",
          chipBalance: 14,
          isStaffMatchCandidate: true,
        },
      ],
      inProgressMatches: [
        {
          matchId: "match-1",
          tableId: "table-1",
          tableNumber: 1,
          displayStatus: "winner_claimed",
          participant1Id: "participant-2",
          participant1Nickname: "Bob",
          participant2Nickname: "Carol",
          isStaffMatch: false,
          startedAt: "2026-04-13T09:02:00.000Z",
        },
      ],
      disconnectedParticipants: [
        {
          participantId: "participant-2",
          nickname: "Bob",
          lastNonDisconnectStatus: "playing",
          lastSeenAt: "2026-04-13T09:07:00.000Z",
        },
      ],
      disputedMatches: [
        {
          matchId: "match-1",
          tableNumber: 1,
          disputeCount: 2,
          lastDisputedAt: "2026-04-13T09:08:00.000Z",
        },
      ],
      stalledMatches: [
        {
          matchId: "match-1",
          tableNumber: 1,
          status: "winner_claimed",
          winnerClaimedAt: "2026-04-13T09:08:30.000Z",
          startedAt: "2026-04-13T09:02:00.000Z",
          participant1Nickname: "Bob",
          participant2Nickname: "Carol",
        },
      ],
    });

    expect(normalizeParticipantConnectionState).toHaveBeenCalledTimes(3);
    expect(normalizeParticipantConnectionState).toHaveBeenCalledWith({
      participantId: "participant-1",
      now: expect.any(Date),
    });
  });
});
