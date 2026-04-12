import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/types";

const { getSupabaseAdminClient } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

import { resolveMatchByAdmin } from "@/lib/services/admin-match-service";
import { disqualifyParticipant } from "@/lib/services/admin-participant-service";
import { resolveStaffMatch, startStaffMatch } from "@/lib/services/staff-match-service";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type ChipLedgerRow = Database["public"]["Tables"]["chip_ledger"]["Row"];

type ResolveMatchByAdminRpcRow =
  Database["public"]["Functions"]["resolve_match_by_admin"]["Returns"][number];
type StartStaffMatchRpcRow =
  Database["public"]["Functions"]["start_staff_match"]["Returns"][number];
type ResolveStaffMatchRpcRow =
  Database["public"]["Functions"]["resolve_staff_match"]["Returns"][number];
type DisqualifyParticipantRpcRow =
  Database["public"]["Functions"]["disqualify_participant"]["Returns"][number];

type FakeState = {
  event: EventRow;
  participants: Record<string, ParticipantRow>;
  matches: Record<string, MatchRow>;
  tables: Record<string, TableRow>;
  chipLedger: ChipLedgerRow[];
  nowCounter: number;
};

function createEventRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: overrides.id ?? "event-1",
    name: overrides.name ?? "Freshers Match",
    venue_code: overrides.venue_code ?? "VENUE",
    initial_chip_balance: overrides.initial_chip_balance ?? 1000,
    fixed_bet_amount: overrides.fixed_bet_amount ?? 100,
    staff_match_wait_seconds: overrides.staff_match_wait_seconds ?? 180,
    disconnect_threshold_seconds: overrides.disconnect_threshold_seconds ?? 60,
    status: overrides.status ?? "active",
    created_at: overrides.created_at ?? "2026-04-12T10:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-12T10:00:00.000Z",
  };
}

function createParticipantRow(
  overrides: Partial<ParticipantRow> & Pick<ParticipantRow, "id" | "nickname">,
): ParticipantRow {
  return {
    id: overrides.id,
    event_id: overrides.event_id ?? "event-1",
    nickname: overrides.nickname,
    status: overrides.status ?? "playing",
    last_non_disconnect_status:
      overrides.last_non_disconnect_status ?? overrides.status ?? "playing",
    chip_balance: overrides.chip_balance ?? 900,
    current_match_id: overrides.current_match_id ?? "match-1",
    last_opponent_participant_id: overrides.last_opponent_participant_id ?? null,
    queued_at: overrides.queued_at ?? null,
    last_seen_at: overrides.last_seen_at ?? "2026-04-12T10:00:00.000Z",
    disqualified_reason: overrides.disqualified_reason ?? null,
    created_at: overrides.created_at ?? "2026-04-12T10:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-12T10:00:00.000Z",
  };
}

function createMatchRow(overrides: Partial<MatchRow> & Pick<MatchRow, "id">): MatchRow {
  return {
    id: overrides.id,
    event_id: overrides.event_id ?? "event-1",
    table_id: overrides.table_id ?? "table-1",
    player1_participant_id: overrides.player1_participant_id ?? "participant-1",
    player2_participant_id: overrides.player2_participant_id ?? "participant-2",
    status: overrides.status ?? "in_progress",
    is_staff_match: overrides.is_staff_match ?? false,
    staff_operator_id: overrides.staff_operator_id ?? null,
    player1_ready_at: overrides.player1_ready_at ?? "2026-04-12T10:00:05.000Z",
    player2_ready_at: overrides.player2_ready_at ?? "2026-04-12T10:00:06.000Z",
    started_at: overrides.started_at ?? "2026-04-12T10:00:10.000Z",
    agreed_bet_amount: overrides.agreed_bet_amount ?? 100,
    dispute_count: overrides.dispute_count ?? 0,
    last_disputed_at: overrides.last_disputed_at ?? null,
    winner_participant_id: overrides.winner_participant_id ?? null,
    winner_claimed_by_participant_id: overrides.winner_claimed_by_participant_id ?? null,
    winner_claimed_at: overrides.winner_claimed_at ?? null,
    completed_at: overrides.completed_at ?? null,
    cancelled_by_participant_id: overrides.cancelled_by_participant_id ?? null,
    void_reason: overrides.void_reason ?? null,
    created_at: overrides.created_at ?? "2026-04-12T10:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-12T10:00:00.000Z",
  };
}

function createTableRow(
  overrides: Partial<TableRow> & Pick<TableRow, "id" | "table_number">,
): TableRow {
  return {
    id: overrides.id,
    event_id: overrides.event_id ?? "event-1",
    table_number: overrides.table_number,
    game_title: overrides.game_title ?? "Smash Bros",
    status: overrides.status ?? "in_use",
    current_match_id: overrides.current_match_id ?? "match-1",
    held_by_admin_user_id: overrides.held_by_admin_user_id ?? null,
    created_at: overrides.created_at ?? "2026-04-12T10:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-12T10:00:00.000Z",
  };
}

function createLedgerRow(overrides: Partial<ChipLedgerRow>): ChipLedgerRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    event_id: overrides.event_id ?? "event-1",
    participant_id: overrides.participant_id ?? "participant-1",
    match_id: overrides.match_id ?? "match-1",
    delta: overrides.delta ?? 0,
    reason: overrides.reason ?? "match_bet",
    balance_after: overrides.balance_after ?? 0,
    created_by_admin_user_id: overrides.created_by_admin_user_id ?? null,
    created_at: overrides.created_at ?? "2026-04-12T10:00:00.000Z",
  };
}

function createDefaultState(): FakeState {
  return {
    event: createEventRow(),
    participants: {
      "participant-1": createParticipantRow({
        id: "participant-1",
        nickname: "Alice",
      }),
      "participant-2": createParticipantRow({
        id: "participant-2",
        nickname: "Bob",
      }),
    },
    matches: {
      "match-1": createMatchRow({
        id: "match-1",
      }),
    },
    tables: {
      "table-1": createTableRow({
        id: "table-1",
        table_number: 1,
      }),
    },
    chipLedger: [
      createLedgerRow({
        participant_id: "participant-1",
        delta: -100,
        reason: "match_bet",
        balance_after: 900,
      }),
      createLedgerRow({
        participant_id: "participant-2",
        delta: -100,
        reason: "match_bet",
        balance_after: 900,
      }),
    ],
    nowCounter: 0,
  };
}

function nextTimestamp(state: FakeState): string {
  state.nowCounter += 1;
  return `2026-04-12T10:00:${String(state.nowCounter).padStart(2, "0")}.000Z`;
}

function getParticipant(state: FakeState, participantId: string): ParticipantRow {
  const participant = state.participants[participantId];

  if (!participant) {
    throw new Error(`Participant not found: ${participantId}`);
  }

  return participant;
}

function getMatch(state: FakeState, matchId: string): MatchRow {
  const match = state.matches[matchId];

  if (!match) {
    throw new Error(`Match not found: ${matchId}`);
  }

  return match;
}

function appendLedgerEntry(
  state: FakeState,
  params: {
    participantId: string;
    delta: number;
    reason: ChipLedgerRow["reason"];
    matchId: string;
    adminUserId?: string;
  },
): void {
  const participant = getParticipant(state, params.participantId);
  participant.chip_balance += params.delta;
  participant.updated_at = nextTimestamp(state);

  state.chipLedger.push(
    createLedgerRow({
      participant_id: params.participantId,
      delta: params.delta,
      reason: params.reason,
      match_id: params.matchId,
      balance_after: participant.chip_balance,
      created_by_admin_user_id: params.adminUserId ?? null,
      created_at: nextTimestamp(state),
    }),
  );
}

function createSupabaseMock(state: FakeState) {
  function resolveMatchByAdminRpc(args: {
    p_admin_user_id: string;
    p_match_id: string;
    p_resolution_type: "void" | "winner";
    p_winner_participant_id: string | null;
  }): ResolveMatchByAdminRpcRow {
    const match = getMatch(state, args.p_match_id);
    const player1 = getParticipant(state, match.player1_participant_id);
    const player2Id = match.player2_participant_id;
    const player2 = player2Id ? getParticipant(state, player2Id) : null;
    const table = state.tables[match.table_id];

    if (args.p_resolution_type === "winner") {
      if (!args.p_winner_participant_id) {
        throw new Error("Winner participant must be present");
      }

      appendLedgerEntry(state, {
        participantId: args.p_winner_participant_id,
        delta: (match.agreed_bet_amount ?? 0) * 2,
        reason: "match_payout",
        matchId: match.id,
        adminUserId: args.p_admin_user_id,
      });
      match.winner_participant_id = args.p_winner_participant_id;
    } else {
      if (match.agreed_bet_amount) {
        appendLedgerEntry(state, {
          participantId: player1.id,
          delta: match.agreed_bet_amount,
          reason: "rollback",
          matchId: match.id,
          adminUserId: args.p_admin_user_id,
        });

        if (player2) {
          appendLedgerEntry(state, {
            participantId: player2.id,
            delta: match.agreed_bet_amount,
            reason: "rollback",
            matchId: match.id,
            adminUserId: args.p_admin_user_id,
          });
        }
      }

      match.void_reason = "admin_void";
      match.winner_participant_id = null;
    }

    match.status = "completed";
    match.completed_at = nextTimestamp(state);
    match.updated_at = nextTimestamp(state);
    match.winner_claimed_by_participant_id = null;

    player1.status = "result_confirmed";
    player1.last_non_disconnect_status = "result_confirmed";
    player1.current_match_id = match.id;
    if (player2) {
      player2.status = "result_confirmed";
      player2.last_non_disconnect_status = "result_confirmed";
      player2.current_match_id = match.id;
    }

    table.status = "available";
    table.current_match_id = null;
    table.updated_at = nextTimestamp(state);

    return {
      match_status: match.status,
    };
  }

  function startStaffMatchRpc(args: {
    p_admin_user_id: string;
    p_participant_id: string;
    p_table_id: string | null;
  }): StartStaffMatchRpcRow {
    const participant = getParticipant(state, args.p_participant_id);
    const table =
      (args.p_table_id ? state.tables[args.p_table_id] : null) ??
      Object.values(state.tables).find((candidate) => candidate.status === "available");

    if (!table) {
      throw new Error("No available table found");
    }

    const matchId = `match-${Object.keys(state.matches).length + 1}`;
    const agreedBetAmount = Math.min(participant.chip_balance, state.event.fixed_bet_amount);
    state.matches[matchId] = createMatchRow({
      id: matchId,
      table_id: table.id,
      player1_participant_id: participant.id,
      player2_participant_id: null,
      is_staff_match: true,
      staff_operator_id: args.p_admin_user_id,
      status: "in_progress",
      agreed_bet_amount: agreedBetAmount,
      started_at: nextTimestamp(state),
      created_at: nextTimestamp(state),
      updated_at: nextTimestamp(state),
    });

    appendLedgerEntry(state, {
      participantId: participant.id,
      delta: -agreedBetAmount,
      reason: "match_bet",
      matchId,
    });

    participant.status = "playing";
    participant.last_non_disconnect_status = "playing";
    participant.current_match_id = matchId;
    participant.updated_at = nextTimestamp(state);

    table.status = "in_use";
    table.current_match_id = matchId;
    table.updated_at = nextTimestamp(state);

    return {
      match_id: matchId,
    };
  }

  function resolveStaffMatchRpc(args: {
    p_admin_user_id: string;
    p_match_id: string;
    p_participant_won: boolean;
  }): ResolveStaffMatchRpcRow {
    const match = getMatch(state, args.p_match_id);
    const participant = getParticipant(state, match.player1_participant_id);
    const table = state.tables[match.table_id];

    if (args.p_participant_won) {
      appendLedgerEntry(state, {
        participantId: participant.id,
        delta: match.agreed_bet_amount ?? 0,
        reason: "match_payout",
        matchId: match.id,
        adminUserId: args.p_admin_user_id,
      });
      match.winner_participant_id = participant.id;
    } else {
      match.winner_participant_id = null;
    }

    match.status = "completed";
    match.completed_at = nextTimestamp(state);
    match.updated_at = nextTimestamp(state);
    participant.status = "result_confirmed";
    participant.last_non_disconnect_status = "result_confirmed";
    participant.current_match_id = match.id;
    participant.updated_at = nextTimestamp(state);
    table.status = "available";
    table.current_match_id = null;
    table.updated_at = nextTimestamp(state);

    return {
      match_status: match.status,
    };
  }

  function disqualifyParticipantRpc(args: {
    p_admin_user_id: string;
    p_participant_id: string;
    p_mode: "void_current_match" | "lose_current_match";
    p_reason: string;
  }): DisqualifyParticipantRpcRow {
    const participant = getParticipant(state, args.p_participant_id);
    participant.status = "disqualified";
    participant.last_non_disconnect_status = "disqualified";
    participant.disqualified_reason = args.p_reason;
    participant.updated_at = nextTimestamp(state);

    const matchId = participant.current_match_id;

    if (!matchId) {
      return {
        participant_status: participant.status,
        affected_match_id: null,
      };
    }

    const match = getMatch(state, matchId);
    const opponentId =
      match.player1_participant_id === participant.id
        ? match.player2_participant_id
        : match.player1_participant_id;
    const opponent = opponentId ? getParticipant(state, opponentId) : null;
    const table = state.tables[match.table_id];

    if (args.p_mode === "void_current_match") {
      if (match.agreed_bet_amount) {
        appendLedgerEntry(state, {
          participantId: participant.id,
          delta: match.agreed_bet_amount,
          reason: "rollback",
          matchId,
          adminUserId: args.p_admin_user_id,
        });

        if (opponent) {
          appendLedgerEntry(state, {
            participantId: opponent.id,
            delta: match.agreed_bet_amount,
            reason: "rollback",
            matchId,
            adminUserId: args.p_admin_user_id,
          });
        }
      }

      match.status = "cancelled_before_start";
      match.void_reason = "participant_disqualified";
      match.winner_participant_id = null;
      if (opponent) {
        opponent.status = "registered";
        opponent.last_non_disconnect_status = "registered";
        opponent.current_match_id = null;
        opponent.updated_at = nextTimestamp(state);
      }
    } else {
      match.status = "completed";
      match.winner_participant_id = opponent?.id ?? null;
      if (opponent) {
        appendLedgerEntry(state, {
          participantId: opponent.id,
          delta: (match.agreed_bet_amount ?? 0) * 2,
          reason: "match_payout",
          matchId,
          adminUserId: args.p_admin_user_id,
        });
        opponent.status = "result_confirmed";
        opponent.last_non_disconnect_status = "result_confirmed";
        opponent.current_match_id = match.id;
        opponent.updated_at = nextTimestamp(state);
      }
    }

    participant.current_match_id = null;
    table.status = "available";
    table.current_match_id = null;
    table.updated_at = nextTimestamp(state);
    match.completed_at = nextTimestamp(state);
    match.updated_at = nextTimestamp(state);

    return {
      participant_status: participant.status,
      affected_match_id: match.id,
    };
  }

  return {
    from(table: "participants" | "matches" | "tables" | "admin_users") {
      return {
        select() {
          const rows =
            table === "participants"
              ? Object.values(state.participants)
              : table === "matches"
                ? Object.values(state.matches)
                : table === "tables"
                  ? Object.values(state.tables)
                  : [];

          return {
            eq(column: string, value: string) {
              const record = rows.find((row) => row[column as never] === value) ?? null;

              return {
                maybeSingle: () =>
                  Promise.resolve({
                    data: record,
                    error: null,
                  }),
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: rows.filter((row) => row[column as never] === value),
                      error: null,
                    }),
                }),
              };
            },
            in() {
              return {
                limit: () =>
                  Promise.resolve({
                    data: [],
                    error: null,
                  }),
              };
            },
            order() {
              return {
                limit: () =>
                  Promise.resolve({
                    data: rows,
                    error: null,
                  }),
              };
            },
          };
        },
      };
    },
    rpc(fn: string, args: Record<string, string | boolean | null>) {
      try {
        switch (fn) {
          case "resolve_match_by_admin":
            return Promise.resolve({
              data: [resolveMatchByAdminRpc(args as never)],
              error: null,
            });
          case "start_staff_match":
            return Promise.resolve({
              data: [startStaffMatchRpc(args as never)],
              error: null,
            });
          case "resolve_staff_match":
            return Promise.resolve({
              data: [resolveStaffMatchRpc(args as never)],
              error: null,
            });
          case "disqualify_participant":
            return Promise.resolve({
              data: [disqualifyParticipantRpc(args as never)],
              error: null,
            });
          default:
            throw new Error(`Unexpected RPC: ${fn}`);
        }
      } catch (error) {
        return Promise.resolve({
          data: null,
          error: {
            message: error instanceof Error ? error.message : "Unknown RPC error",
          },
        });
      }
    },
  };
}

describe("admin ops", () => {
  let state: FakeState;

  beforeEach(() => {
    state = createDefaultState();
    getSupabaseAdminClient.mockReturnValue(createSupabaseMock(state));
  });

  it("keeps participant, match, table, and ledger consistent when admin resolves a disputed match", async () => {
    state.matches["match-1"].status = "winner_claimed";
    state.matches["match-1"].dispute_count = 1;
    state.matches["match-1"].winner_claimed_by_participant_id = "participant-1";
    state.participants["participant-1"].status = "claiming_win";
    state.participants["participant-2"].status = "awaiting_result_approval";

    await resolveMatchByAdmin({
      adminUserId: "admin-1",
      matchId: "match-1",
      resolution: {
        type: "winner",
        winnerParticipantId: "participant-1",
      },
    });

    expect(state.participants["participant-1"]).toMatchObject({
      status: "result_confirmed",
      current_match_id: "match-1",
      chip_balance: 1100,
    });
    expect(state.participants["participant-2"]).toMatchObject({
      status: "result_confirmed",
      current_match_id: "match-1",
      chip_balance: 900,
    });
    expect(state.matches["match-1"]).toMatchObject({
      status: "completed",
      winner_claimed_by_participant_id: null,
      winner_participant_id: "participant-1",
    });
    expect(state.tables["table-1"]).toMatchObject({
      status: "available",
      current_match_id: null,
    });
    expect(state.chipLedger.map((entry) => [entry.reason, entry.delta])).toEqual([
      ["match_bet", -100],
      ["match_bet", -100],
      ["match_payout", 200],
    ]);
  });

  it("creates and resolves a staff match with participant-only ledger effects", async () => {
    state.matches = {};
    state.tables = {
      "table-1": createTableRow({
        id: "table-1",
        table_number: 1,
        status: "available",
        current_match_id: null,
      }),
    };
    state.chipLedger = [];
    state.participants = {
      "participant-1": createParticipantRow({
        id: "participant-1",
        nickname: "Alice",
        status: "queueing",
        last_non_disconnect_status: "queueing",
        current_match_id: null,
        chip_balance: 80,
      }),
    };

    const startResult = await startStaffMatch({
      adminUserId: "admin-1",
      participantId: "participant-1",
      optionalTableId: "table-1",
    });

    expect(startResult.matchId).toBe("match-1");
    expect(state.participants["participant-1"]).toMatchObject({
      status: "playing",
      current_match_id: "match-1",
      chip_balance: 0,
    });
    expect(state.matches["match-1"]).toMatchObject({
      status: "in_progress",
      is_staff_match: true,
      agreed_bet_amount: 80,
      winner_claimed_by_participant_id: null,
      winner_participant_id: null,
    });
    expect(state.tables["table-1"]).toMatchObject({
      status: "in_use",
      current_match_id: "match-1",
    });
    expect(state.chipLedger.map((entry) => [entry.reason, entry.delta])).toEqual([
      ["match_bet", -80],
    ]);

    await resolveStaffMatch({
      adminUserId: "admin-1",
      matchId: "match-1",
      participantWon: true,
    });

    expect(state.participants["participant-1"]).toMatchObject({
      status: "result_confirmed",
      current_match_id: "match-1",
      chip_balance: 80,
    });
    expect(state.matches["match-1"]).toMatchObject({
      status: "completed",
      winner_participant_id: "participant-1",
    });
    expect(state.tables["table-1"]).toMatchObject({
      status: "available",
      current_match_id: null,
    });
    expect(state.chipLedger.map((entry) => [entry.reason, entry.delta])).toEqual([
      ["match_bet", -80],
      ["match_payout", 80],
    ]);
  });

  it("voids the current match on disqualification without leaving chip or table corruption", async () => {
    await disqualifyParticipant({
      adminUserId: "admin-1",
      participantId: "participant-1",
      mode: "void_current_match",
      reason: "rule violation",
    });

    expect(state.participants["participant-1"]).toMatchObject({
      status: "disqualified",
      current_match_id: null,
      chip_balance: 1000,
      disqualified_reason: "rule violation",
    });
    expect(state.participants["participant-2"]).toMatchObject({
      status: "registered",
      current_match_id: null,
      chip_balance: 1000,
    });
    expect(state.matches["match-1"]).toMatchObject({
      status: "cancelled_before_start",
      winner_participant_id: null,
      void_reason: "participant_disqualified",
    });
    expect(state.tables["table-1"]).toMatchObject({
      status: "available",
      current_match_id: null,
    });
    expect(state.chipLedger.map((entry) => [entry.reason, entry.delta])).toEqual([
      ["match_bet", -100],
      ["match_bet", -100],
      ["rollback", 100],
      ["rollback", 100],
    ]);
  });

  it("awards the opponent on lose_current_match disqualification without double-applying ledger", async () => {
    await disqualifyParticipant({
      adminUserId: "admin-1",
      participantId: "participant-1",
      mode: "lose_current_match",
      reason: "forfeit",
    });

    expect(state.participants["participant-1"]).toMatchObject({
      status: "disqualified",
      current_match_id: null,
      chip_balance: 900,
      disqualified_reason: "forfeit",
    });
    expect(state.participants["participant-2"]).toMatchObject({
      status: "result_confirmed",
      current_match_id: "match-1",
      chip_balance: 1100,
    });
    expect(state.matches["match-1"]).toMatchObject({
      status: "completed",
      winner_participant_id: "participant-2",
    });
    expect(state.tables["table-1"]).toMatchObject({
      status: "available",
      current_match_id: null,
    });
    expect(state.chipLedger.map((entry) => [entry.reason, entry.delta])).toEqual([
      ["match_bet", -100],
      ["match_bet", -100],
      ["match_payout", 200],
    ]);
  });
});
