import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";
import type { Database } from "@/lib/db/types";
import { DomainConflictError } from "@/lib/domain/errors";

const { getSupabaseAdminClient, getParticipantRuntimeState } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  getParticipantRuntimeState: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

vi.mock("@/lib/services/participant-service", () => ({
  getParticipantRuntimeState,
}));

import {
  executeApproveResult,
  executeCancelBeforeStart,
  executeClaimWin,
  executeReadyMatch,
} from "@/lib/services/match-service";
import { executeStartQueue, tryCreateNextMatch } from "@/lib/services/matching-service";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type ChipLedgerRow = Database["public"]["Tables"]["chip_ledger"]["Row"];

type ReadyMatchRpcRow = Database["public"]["Functions"]["ready_match"]["Returns"][number];
type CancelMatchBeforeStartRpcRow =
  Database["public"]["Functions"]["cancel_match_before_start"]["Returns"][number];
type ClaimMatchWinRpcRow = Database["public"]["Functions"]["claim_match_win"]["Returns"][number];
type ApproveMatchResultRpcRow =
  Database["public"]["Functions"]["approve_match_result"]["Returns"][number];
type StartQueueRpcRow =
  Database["public"]["Functions"]["start_queue_and_try_match"]["Returns"][number];

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
    status: overrides.status ?? "match_reserved",
    last_non_disconnect_status:
      overrides.last_non_disconnect_status ?? overrides.status ?? "match_reserved",
    chip_balance: overrides.chip_balance ?? 1000,
    current_match_id:
      overrides.current_match_id === undefined ? "match-1" : overrides.current_match_id,
    last_opponent_participant_id: overrides.last_opponent_participant_id ?? null,
    queued_at: overrides.queued_at ?? null,
    last_seen_at: overrides.last_seen_at ?? "2026-04-12T10:00:00.000Z",
    disqualified_reason: overrides.disqualified_reason ?? null,
    created_at: overrides.created_at ?? "2026-04-12T10:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-12T10:00:00.000Z",
  };
}

function createMatchRow(overrides: Partial<MatchRow> & Pick<MatchRow, "id">): MatchRow {
  const isStaffMatch = overrides.is_staff_match ?? false;

  return {
    id: overrides.id,
    event_id: overrides.event_id ?? "event-1",
    table_id: overrides.table_id ?? "table-1",
    player1_participant_id: overrides.player1_participant_id ?? "participant-1",
    player2_participant_id: overrides.player2_participant_id ?? "participant-2",
    status: overrides.status ?? "reserved",
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
    game_rule_id: overrides.game_rule_id ?? null,
    status: overrides.status ?? "reserved",
    current_match_id:
      overrides.current_match_id === undefined ? "match-1" : overrides.current_match_id,
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
    chipLedger: [],
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

function getOpponentId(match: MatchRow, participantId: string): string | null {
  if (match.player1_participant_id === participantId) {
    return match.player2_participant_id;
  }

  if (match.player2_participant_id === participantId) {
    return match.player1_participant_id;
  }

  return null;
}

function appendLedgerEntry(
  state: FakeState,
  params: {
    participantId: string;
    delta: number;
    reason: ChipLedgerRow["reason"];
    matchId: string;
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
      created_at: nextTimestamp(state),
    }),
  );
}

function buildRuntimeState(state: FakeState, participantId: string): ParticipantRuntimeState {
  const participant = getParticipant(state, participantId);
  const match = participant.current_match_id
    ? (state.matches[participant.current_match_id] ?? null)
    : null;
  const table = match ? (state.tables[match.table_id] ?? null) : null;
  const opponentId = match ? getOpponentId(match, participantId) : null;
  const opponent = opponentId ? (state.participants[opponentId] ?? null) : null;
  const turnRole =
    match === null || match.is_staff_match
      ? null
      : match.player1_participant_id === participantId
        ? match.player1_turn_role
        : match.player2_turn_role;
  const resultDelta =
    participant.status === "result_confirmed" && participant.current_match_id
      ? state.chipLedger
          .filter(
            (entry) =>
              entry.match_id === participant.current_match_id &&
              entry.participant_id === participant.id &&
              (entry.reason === "match_bet" || entry.reason === "match_payout"),
          )
          .reduce((sum, entry) => sum + entry.delta, 0)
      : null;

  return {
    participantId: participant.id,
    eventId: participant.event_id,
    nickname: participant.nickname,
    status: participant.status,
    lastNonDisconnectStatus: participant.last_non_disconnect_status,
    chipBalance: participant.chip_balance,
    currentMatchId: participant.current_match_id,
    queuedAt: participant.queued_at,
    table: table
      ? {
          id: table.id,
          tableNumber: table.table_number,
          gameTitle: table.game_title,
          ruleId: table.game_rule_id,
          status: table.status,
        }
      : null,
    match: match
      ? {
          id: match.id,
          status: match.status,
          isStaffMatch: match.is_staff_match,
          agreedBetAmount: match.agreed_bet_amount,
          disputeCount: match.dispute_count,
        }
      : null,
    opponent: opponent
      ? {
          participantId: opponent.id,
          nickname: opponent.nickname,
        }
      : null,
    turnRole,
    opponentReady:
      match === null
        ? false
        : match.is_staff_match
          ? true
          : match.status === "awaiting_ready" && participant.status !== "match_reserved",
    winnerParticipantId: match?.winner_participant_id ?? null,
    winnerClaimedByParticipantId: match?.winner_claimed_by_participant_id ?? null,
    disqualifiedReason:
      participant.status === "disqualified" ? participant.disqualified_reason : null,
    resultDelta,
    resultConfirmedAt: match?.completed_at ?? null,
    canStartMatching: participant.status === "registered" && participant.chip_balance > 0,
    canClaimWin: participant.status === "playing" && match !== null && !match.is_staff_match,
  };
}

function createSupabaseMock(state: FakeState) {
  function readyMatch(participantId: string, matchId: string): ReadyMatchRpcRow {
    const match = getMatch(state, matchId);
    const participant = getParticipant(state, participantId);

    if (
      match.player1_participant_id !== participantId &&
      match.player2_participant_id !== participantId
    ) {
      throw new Error("Participant is not part of the match");
    }

    if (match.status === "in_progress") {
      return {
        match_status: match.status,
        participant_status: participant.status,
        agreed_bet_amount: match.agreed_bet_amount,
        started_at: match.started_at,
      };
    }

    if (match.status !== "reserved" && match.status !== "awaiting_ready") {
      throw new Error("Match is not reserved or awaiting_ready");
    }

    if (participant.status === "ready" || participant.status === "playing") {
      return {
        match_status: match.status,
        participant_status: participant.status,
        agreed_bet_amount: match.agreed_bet_amount,
        started_at: match.started_at,
      };
    }

    const side =
      match.player1_participant_id === participantId ? "player1_ready_at" : "player2_ready_at";
    match[side] = nextTimestamp(state);

    if (!match.player1_ready_at || !match.player2_ready_at) {
      match.status = "awaiting_ready";
      participant.status = "ready";
      participant.last_non_disconnect_status = "ready";
      participant.updated_at = nextTimestamp(state);

      return {
        match_status: match.status,
        participant_status: participant.status,
        agreed_bet_amount: match.agreed_bet_amount,
        started_at: match.started_at,
      };
    }

    const opponentId = getOpponentId(match, participantId);

    if (!opponentId) {
      throw new Error("Head-to-head match is missing an opponent");
    }

    const opponent = getParticipant(state, opponentId);
    const betAmount = Math.min(
      participant.chip_balance,
      opponent.chip_balance,
      state.event.fixed_bet_amount,
    );

    if (match.agreed_bet_amount === null) {
      match.agreed_bet_amount = betAmount;
      match.started_at = nextTimestamp(state);
      appendLedgerEntry(state, {
        participantId: match.player1_participant_id,
        delta: -betAmount,
        reason: "match_bet",
        matchId,
      });
      appendLedgerEntry(state, {
        participantId: match.player2_participant_id as string,
        delta: -betAmount,
        reason: "match_bet",
        matchId,
      });
    }

    match.status = "in_progress";
    participant.status = "playing";
    participant.last_non_disconnect_status = "playing";
    participant.updated_at = nextTimestamp(state);
    opponent.status = "playing";
    opponent.last_non_disconnect_status = "playing";
    opponent.updated_at = nextTimestamp(state);
    state.tables[match.table_id].status = "in_use";

    return {
      match_status: match.status,
      participant_status: participant.status,
      agreed_bet_amount: match.agreed_bet_amount,
      started_at: match.started_at,
    };
  }

  function cancelBeforeStart(participantId: string, matchId: string): CancelMatchBeforeStartRpcRow {
    const match = getMatch(state, matchId);

    if (
      match.player1_participant_id !== participantId &&
      match.player2_participant_id !== participantId
    ) {
      throw new Error("Participant is not part of the match");
    }

    if (match.status !== "reserved" && match.status !== "awaiting_ready") {
      throw new Error("Match already started");
    }

    match.status = "cancelled_before_start";
    match.cancelled_by_participant_id = participantId;
    match.updated_at = nextTimestamp(state);

    const participantIds = [match.player1_participant_id, match.player2_participant_id].filter(
      (id): id is string => typeof id === "string",
    );

    for (const id of participantIds) {
      const participant = getParticipant(state, id);
      participant.status = "registered";
      participant.last_non_disconnect_status = "registered";
      participant.current_match_id = null;
      participant.updated_at = nextTimestamp(state);
    }

    const table = state.tables[match.table_id];
    table.status = "available";
    table.current_match_id = null;
    table.updated_at = nextTimestamp(state);

    return {
      match_status: match.status,
    };
  }

  function claimWin(participantId: string, matchId: string): ClaimMatchWinRpcRow {
    const match = getMatch(state, matchId);

    if (match.status === "winner_claimed") {
      throw new Error("Match already winner_claimed");
    }

    if (match.status !== "in_progress") {
      throw new Error("Match is not in_progress");
    }

    const opponentId = getOpponentId(match, participantId);
    match.status = "winner_claimed";
    match.winner_claimed_by_participant_id = participantId;
    match.winner_claimed_at = nextTimestamp(state);
    match.updated_at = nextTimestamp(state);

    const claimer = getParticipant(state, participantId);
    claimer.status = "claiming_win";
    claimer.last_non_disconnect_status = "claiming_win";
    claimer.updated_at = nextTimestamp(state);

    if (opponentId) {
      const opponent = getParticipant(state, opponentId);
      opponent.status = "awaiting_result_approval";
      opponent.last_non_disconnect_status = "awaiting_result_approval";
      opponent.updated_at = nextTimestamp(state);
    }

    return {
      match_status: match.status,
    };
  }

  function approveResult(
    participantId: string,
    matchId: string,
    approve: boolean,
  ): ApproveMatchResultRpcRow {
    const match = getMatch(state, matchId);

    if (match.status !== "winner_claimed") {
      return {
        match_status: match.status,
        dispute_count: match.dispute_count,
      };
    }

    const claimerId = match.winner_claimed_by_participant_id;

    if (!claimerId) {
      throw new Error("Match is missing a winner claim");
    }

    if (participantId === claimerId) {
      throw new Error("claiming participant cannot approve");
    }

    const claimer = getParticipant(state, claimerId);
    const approver = getParticipant(state, participantId);

    if (!approve) {
      match.status = "in_progress";
      match.winner_claimed_by_participant_id = null;
      match.winner_claimed_at = null;
      match.dispute_count += 1;
      match.last_disputed_at = nextTimestamp(state);
      match.updated_at = nextTimestamp(state);

      claimer.status = "playing";
      claimer.last_non_disconnect_status = "playing";
      claimer.updated_at = nextTimestamp(state);
      approver.status = "playing";
      approver.last_non_disconnect_status = "playing";
      approver.updated_at = nextTimestamp(state);

      return {
        match_status: match.status,
        dispute_count: match.dispute_count,
      };
    }

    match.status = "completed";
    match.winner_participant_id = claimerId;
    match.completed_at = nextTimestamp(state);
    match.updated_at = nextTimestamp(state);

    appendLedgerEntry(state, {
      participantId: claimerId,
      delta: (match.agreed_bet_amount ?? 0) * 2,
      reason: "match_payout",
      matchId,
    });

    const opponentId = getOpponentId(match, claimerId);
    claimer.status = "result_confirmed";
    claimer.last_non_disconnect_status = "result_confirmed";
    claimer.last_opponent_participant_id = opponentId;
    claimer.updated_at = nextTimestamp(state);
    approver.status = "result_confirmed";
    approver.last_non_disconnect_status = "result_confirmed";
    approver.last_opponent_participant_id = claimer.id;
    approver.updated_at = nextTimestamp(state);

    const table = state.tables[match.table_id];
    table.status = "available";
    table.current_match_id = null;
    table.updated_at = nextTimestamp(state);

    return {
      match_status: match.status,
      dispute_count: match.dispute_count,
    };
  }

  function startQueue(
    participantId: string,
    opponentId: string | null,
    tableId: string | null,
  ): StartQueueRpcRow {
    const participant = getParticipant(state, participantId);

    if (participant.status !== "registered" && participant.status !== "queueing") {
      throw new Error("Participant is not in queueable status");
    }

    if (participant.chip_balance <= 0) {
      throw new Error("Participant chip balance must be positive");
    }

    participant.status = "queueing";
    participant.last_non_disconnect_status = "queueing";
    participant.queued_at = participant.queued_at ?? nextTimestamp(state);
    participant.updated_at = nextTimestamp(state);

    if (!opponentId || !tableId) {
      return {
        match_id: null,
        participant_status: participant.status,
      };
    }

    const opponent = getParticipant(state, opponentId);
    const table = state.tables[tableId];

    if (opponent.status !== "queueing" || opponent.current_match_id !== null) {
      return {
        match_id: null,
        participant_status: participant.status,
      };
    }

    if (!table || table.status !== "available" || table.current_match_id !== null) {
      return {
        match_id: null,
        participant_status: participant.status,
      };
    }

    const matchId = `match-${Object.keys(state.matches).length + 1}`;
    state.matches[matchId] = createMatchRow({
      id: matchId,
      status: "reserved",
      table_id: tableId,
      player1_participant_id: participantId,
      player2_participant_id: opponentId,
      created_at: nextTimestamp(state),
      updated_at: nextTimestamp(state),
    });

    participant.status = "match_reserved";
    participant.last_non_disconnect_status = "match_reserved";
    participant.current_match_id = matchId;
    opponent.status = "match_reserved";
    opponent.last_non_disconnect_status = "match_reserved";
    opponent.current_match_id = matchId;
    table.status = "reserved";
    table.current_match_id = matchId;

    return {
      match_id: matchId,
      participant_status: participant.status,
    };
  }

  return {
    from(table: "events" | "participants" | "tables" | "matches") {
      return {
        select() {
          let rows: Array<Record<string, unknown>> =
            table === "events"
              ? [state.event]
              : table === "participants"
                ? Object.values(state.participants)
                : table === "tables"
                  ? Object.values(state.tables)
                  : Object.values(state.matches);

          const query = {
            eq(column: string, value: string) {
              rows = rows.filter((row) => row[column] === value);
              return query;
            },
            gt(column: string, value: number) {
              rows = rows.filter((row) => Number(row[column]) > value);
              return query;
            },
            is(column: string, value: null) {
              rows = rows.filter((row) => row[column] === value);
              return query;
            },
            order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
              const ascending = options?.ascending ?? true;
              const nullsFirst = options?.nullsFirst ?? false;

              rows = [...rows].sort((left, right) => {
                const leftValue = left[column];
                const rightValue = right[column];

                if (leftValue === rightValue) {
                  return 0;
                }

                if (leftValue === null || leftValue === undefined) {
                  return nullsFirst ? -1 : 1;
                }

                if (rightValue === null || rightValue === undefined) {
                  return nullsFirst ? 1 : -1;
                }

                return leftValue < rightValue ? (ascending ? -1 : 1) : ascending ? 1 : -1;
              });

              return query;
            },
            limit(count: number) {
              return Promise.resolve({
                data: rows.slice(0, count),
                error: null,
              });
            },
            maybeSingle() {
              return Promise.resolve({
                data: rows[0] ?? null,
                error: null,
              });
            },
          };

          return query;
        },
        update(values: Record<string, unknown>) {
          return {
            eq(column: string, value: string) {
              return {
                select(columns: string) {
                  let updatedRows: any[] = [];
                  if (table === "participants" && column === "id") {
                    const participant = state.participants[value];
                    if (participant) {
                      Object.assign(participant, values);
                      updatedRows = [participant];
                    }
                  }
                  return Promise.resolve({
                    data: updatedRows,
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
    rpc(fn: string, args: Record<string, boolean | string | null>) {
      try {
        switch (fn) {
          case "ready_match":
            return Promise.resolve({
              data: [readyMatch(args.p_participant_id as string, args.p_match_id as string)],
              error: null,
            });
          case "cancel_match_before_start":
            return Promise.resolve({
              data: [cancelBeforeStart(args.p_participant_id as string, args.p_match_id as string)],
              error: null,
            });
          case "claim_match_win":
            return Promise.resolve({
              data: [claimWin(args.p_participant_id as string, args.p_match_id as string)],
              error: null,
            });
          case "approve_match_result":
            return Promise.resolve({
              data: [
                approveResult(
                  args.p_participant_id as string,
                  args.p_match_id as string,
                  args.p_approve as boolean,
                ),
              ],
              error: null,
            });
          case "start_queue_and_try_match":
            return Promise.resolve({
              data: [
                startQueue(
                  args.p_participant_id as string,
                  (args.p_opponent_participant_id as string | null) ?? null,
                  (args.p_table_id as string | null) ?? null,
                ),
              ],
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

describe("matching flow", () => {
  let state: FakeState;

  beforeEach(() => {
    state = createDefaultState();
    getSupabaseAdminClient.mockReturnValue(createSupabaseMock(state));
    getParticipantRuntimeState.mockImplementation(async (participantId: string) =>
      buildRuntimeState(state, participantId),
    );
  });

  it("keeps participant, match, table, and ledger consistent on cancel before start", async () => {
    await executeReadyMatch({
      participantId: "participant-1",
      matchId: "match-1",
    });

    await executeCancelBeforeStart({
      participantId: "participant-2",
      matchId: "match-1",
    });

    expect(state.participants["participant-1"]).toMatchObject({
      status: "registered",
      current_match_id: null,
      chip_balance: 1000,
    });
    expect(state.participants["participant-2"]).toMatchObject({
      status: "registered",
      current_match_id: null,
      chip_balance: 1000,
    });
    expect(state.matches["match-1"]).toMatchObject({
      status: "cancelled_before_start",
      winner_claimed_by_participant_id: null,
      winner_participant_id: null,
    });
    expect(state.tables["table-1"]).toMatchObject({
      status: "available",
      current_match_id: null,
    });
    expect(state.chipLedger).toHaveLength(0);
  });

  it("returns a claimed result to in_progress on approval rejection without side effects", async () => {
    await executeReadyMatch({ participantId: "participant-1", matchId: "match-1" });
    await executeReadyMatch({ participantId: "participant-2", matchId: "match-1" });
    await executeClaimWin({ participantId: "participant-1", matchId: "match-1" });
    const ledgerBeforeReject = [...state.chipLedger];

    const runtime = await executeApproveResult({
      participantId: "participant-2",
      matchId: "match-1",
      approve: false,
    });

    expect(runtime.status).toBe("playing");
    expect(state.participants["participant-1"]).toMatchObject({
      status: "playing",
      current_match_id: "match-1",
      chip_balance: 900,
    });
    expect(state.participants["participant-2"]).toMatchObject({
      status: "playing",
      current_match_id: "match-1",
      chip_balance: 900,
    });
    expect(state.matches["match-1"]).toMatchObject({
      status: "in_progress",
      dispute_count: 1,
      winner_claimed_by_participant_id: null,
      winner_participant_id: null,
    });
    expect(state.matches["match-1"].last_disputed_at).not.toBeNull();
    expect(state.tables["table-1"]).toMatchObject({
      status: "in_use",
      current_match_id: "match-1",
    });
    expect(state.chipLedger).toEqual(ledgerBeforeReject);
  });

  it("resolves ready/cancel race to cancellation without leaking bet or start state", async () => {
    await executeReadyMatch({
      participantId: "participant-1",
      matchId: "match-1",
    });

    await executeCancelBeforeStart({
      participantId: "participant-2",
      matchId: "match-1",
    });

    await expect(
      executeReadyMatch({
        participantId: "participant-2",
        matchId: "match-1",
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);

    expect(state.participants["participant-1"]).toMatchObject({
      status: "registered",
      current_match_id: null,
      chip_balance: 1000,
    });
    expect(state.participants["participant-2"]).toMatchObject({
      status: "registered",
      current_match_id: null,
      chip_balance: 1000,
    });
    expect(state.matches["match-1"]).toMatchObject({
      status: "cancelled_before_start",
      agreed_bet_amount: null,
      started_at: null,
      winner_claimed_by_participant_id: null,
      winner_participant_id: null,
    });
    expect(state.tables["table-1"]).toMatchObject({
      status: "available",
      current_match_id: null,
    });
    expect(state.chipLedger).toHaveLength(0);
  });

  it("prevents double approval from paying out twice or altering released entities", async () => {
    await executeReadyMatch({ participantId: "participant-1", matchId: "match-1" });
    await executeReadyMatch({ participantId: "participant-2", matchId: "match-1" });
    await executeClaimWin({ participantId: "participant-1", matchId: "match-1" });
    await executeApproveResult({
      participantId: "participant-2",
      matchId: "match-1",
      approve: true,
    });

    const ledgerAfterFirstApproval = [...state.chipLedger];
    const player1BalanceAfterFirstApproval = state.participants["participant-1"]?.chip_balance;
    const player2BalanceAfterFirstApproval = state.participants["participant-2"]?.chip_balance;

    await executeApproveResult({
      participantId: "participant-2",
      matchId: "match-1",
      approve: true,
    });

    expect(state.participants["participant-1"]).toMatchObject({
      status: "result_confirmed",
      current_match_id: "match-1",
      chip_balance: player1BalanceAfterFirstApproval,
    });
    expect(state.participants["participant-2"]).toMatchObject({
      status: "result_confirmed",
      current_match_id: "match-1",
      chip_balance: player2BalanceAfterFirstApproval,
    });
    expect(state.matches["match-1"]).toMatchObject({
      status: "completed",
      winner_claimed_by_participant_id: "participant-1",
      winner_participant_id: "participant-1",
    });
    expect(state.tables["table-1"]).toMatchObject({
      status: "available",
      current_match_id: null,
    });
    expect(state.chipLedger).toEqual(ledgerAfterFirstApproval);
    expect(state.chipLedger.map((entry) => [entry.reason, entry.delta])).toEqual([
      ["match_bet", -100],
      ["match_bet", -100],
      ["match_payout", 200],
    ]);
  });

  it("leaves queueing participants untouched when no table is available", async () => {
    state.matches = {};
    state.tables = {
      "table-1": createTableRow({
        id: "table-1",
        table_number: 1,
        status: "in_use",
        current_match_id: "existing-match",
      }),
    };
    state.participants = {
      "participant-1": createParticipantRow({
        id: "participant-1",
        nickname: "Alice",
        status: "registered",
        last_non_disconnect_status: "registered",
        current_match_id: null,
      }),
      "participant-2": createParticipantRow({
        id: "participant-2",
        nickname: "Bob",
        status: "queueing",
        last_non_disconnect_status: "queueing",
        current_match_id: null,
        queued_at: "2026-04-12T09:59:00.000Z",
      }),
    };

    const runtime = await executeStartQueue({
      participantId: "participant-1",
    });

    expect(runtime.status).toBe("queueing");
    expect(state.participants["participant-1"]).toMatchObject({
      status: "queueing",
      current_match_id: null,
    });
    expect(state.participants["participant-2"]).toMatchObject({
      status: "queueing",
      current_match_id: null,
    });
    expect(await tryCreateNextMatch("event-1")).toBeNull();
    expect(Object.keys(state.matches)).toHaveLength(0);
    expect(state.tables["table-1"]).toMatchObject({
      status: "in_use",
      current_match_id: "existing-match",
    });
    expect(state.chipLedger).toHaveLength(0);
  });
});
