import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";
import type { Database } from "@/lib/db/types";
import { DomainConflictError } from "@/lib/domain/errors";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type ChipLedgerRow = Database["public"]["Tables"]["chip_ledger"]["Row"];

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
  acknowledgeResultConfirmed,
  completeMatchAndApplyChipLedger,
  executeCancelClaimWin,
  executeApproveResult,
  executeCancelBeforeStart,
  executeClaimWin,
  executeReadyMatch,
} from "@/lib/services/match-service";

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

type FakeState = {
  event: EventRow;
  participants: Record<string, ParticipantRow>;
  matches: Record<string, MatchRow>;
  tables: Record<string, TableRow>;
  chipLedger: ChipLedgerRow[];
  nowCounter: number;
};

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

function getOpponentId(match: MatchRow, participantId: string): string | null {
  if (match.player1_participant_id === participantId) {
    return match.player2_participant_id;
  }

  if (match.player2_participant_id === participantId) {
    return match.player1_participant_id;
  }

  return null;
}

function getParticipantSide(match: MatchRow, participantId: string): "player1" | "player2" | null {
  if (match.player1_participant_id === participantId) {
    return "player1";
  }

  if (match.player2_participant_id === participantId) {
    return "player2";
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
  const participant = state.participants[params.participantId];

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
  const participant = state.participants[participantId];
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
  function getParticipant(participantId: string): ParticipantRow {
    const participant = state.participants[participantId];

    if (!participant) {
      throw new Error("Participant not found");
    }

    return participant;
  }

  function getMatch(matchId: string): MatchRow {
    const match = state.matches[matchId];

    if (!match) {
      throw new Error("Match not found");
    }

    return match;
  }

  function ensureParticipantInMatch(participantId: string, match: MatchRow): void {
    if (
      match.player1_participant_id === participantId ||
      match.player2_participant_id === participantId
    ) {
      return;
    }

    throw new Error("Participant is not part of the match");
  }

  function readyMatch(participantId: string, matchId: string) {
    const participant = getParticipant(participantId);
    const match = getMatch(matchId);
    ensureParticipantInMatch(participantId, match);

    if (match.status === "in_progress") {
      return {
        match_status: match.status,
        participant_status: participant.status,
        agreed_bet_amount: match.agreed_bet_amount,
        started_at: match.started_at,
      };
    }

    if (match.status !== "reserved" && match.status !== "awaiting_ready") {
      throw new Error("Match is not in a readyable state");
    }

    const side = getParticipantSide(match, participantId);
    const opponentId = getOpponentId(match, participantId);
    const now = nextTimestamp(state);

    if (side === "player1") {
      match.player1_ready_at ??= now;
    } else if (side === "player2") {
      match.player2_ready_at ??= now;
    }

    if (match.is_staff_match) {
      const betAmount = Math.min(participant.chip_balance, state.event.fixed_bet_amount);
      match.status = "in_progress";
      match.started_at ??= nextTimestamp(state);
      match.agreed_bet_amount ??= betAmount;
      participant.status = "playing";
      participant.last_non_disconnect_status = "playing";
      state.tables[match.table_id].status = "in_use";
      appendLedgerEntry(state, {
        participantId,
        delta: -betAmount,
        reason: "match_bet",
        matchId,
      });

      return {
        match_status: match.status,
        participant_status: participant.status,
        agreed_bet_amount: match.agreed_bet_amount,
        started_at: match.started_at,
      };
    }

    const opponentReadyAt = side === "player1" ? match.player2_ready_at : match.player1_ready_at;

    if (!opponentReadyAt) {
      match.status = "awaiting_ready";
      participant.status = "ready";
      participant.last_non_disconnect_status = "ready";

      return {
        match_status: match.status,
        participant_status: participant.status,
        agreed_bet_amount: match.agreed_bet_amount,
        started_at: match.started_at,
      };
    }

    if (match.agreed_bet_amount === null) {
      if (!opponentId) {
        throw new Error("Head-to-head match is missing an opponent");
      }

      const opponent = getParticipant(opponentId);
      const betAmount = Math.min(
        participant.chip_balance,
        opponent.chip_balance,
        state.event.fixed_bet_amount,
      );

      match.agreed_bet_amount = betAmount;
      match.started_at = nextTimestamp(state);
      appendLedgerEntry(state, {
        participantId: match.player1_participant_id,
        delta: -betAmount,
        reason: "match_bet",
        matchId,
      });

      if (!match.player2_participant_id) {
        throw new Error("Head-to-head match is missing player2");
      }

      appendLedgerEntry(state, {
        participantId: match.player2_participant_id,
        delta: -betAmount,
        reason: "match_bet",
        matchId,
      });
    }

    match.status = "in_progress";
    participant.status = "playing";
    participant.last_non_disconnect_status = "playing";

    if (opponentId) {
      const opponent = getParticipant(opponentId);
      opponent.status = "playing";
      opponent.last_non_disconnect_status = "playing";
      opponent.updated_at = nextTimestamp(state);
    }

    state.tables[match.table_id].status = "in_use";

    return {
      match_status: match.status,
      participant_status: participant.status,
      agreed_bet_amount: match.agreed_bet_amount,
      started_at: match.started_at,
    };
  }

  function cancelBeforeStart(participantId: string, matchId: string) {
    const match = getMatch(matchId);
    ensureParticipantInMatch(participantId, match);

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
      const participant = getParticipant(id);
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

  function claimWin(participantId: string, matchId: string) {
    const match = getMatch(matchId);
    ensureParticipantInMatch(participantId, match);

    if (match.is_staff_match) {
      throw new Error("Cannot claim win for staff match");
    }

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

    const claimer = getParticipant(participantId);
    claimer.status = "claiming_win";
    claimer.last_non_disconnect_status = "claiming_win";
    claimer.updated_at = nextTimestamp(state);

    if (opponentId) {
      const opponent = getParticipant(opponentId);
      opponent.status = "awaiting_result_approval";
      opponent.last_non_disconnect_status = "awaiting_result_approval";
      opponent.updated_at = nextTimestamp(state);
    }

    return {
      match_status: match.status,
    };
  }

  function approveResult(participantId: string, matchId: string, approve: boolean) {
    const match = getMatch(matchId);
    ensureParticipantInMatch(participantId, match);

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

    const claimer = getParticipant(claimerId);
    const approver = getParticipant(participantId);

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

    const payout = (match.agreed_bet_amount ?? 0) * 2;
    appendLedgerEntry(state, {
      participantId: claimerId,
      delta: payout,
      reason: "match_payout",
      matchId,
    });

    const opponentId = getOpponentId(match, claimerId);
    const opponent = opponentId ? getParticipant(opponentId) : null;
    claimer.status = "result_confirmed";
    claimer.last_non_disconnect_status = "result_confirmed";
    claimer.last_opponent_participant_id = opponentId;
    claimer.updated_at = nextTimestamp(state);

    approver.status = "result_confirmed";
    approver.last_non_disconnect_status = "result_confirmed";
    approver.last_opponent_participant_id = claimer.id;
    approver.updated_at = nextTimestamp(state);

    if (opponent && opponent.id !== approver.id) {
      opponent.status = "result_confirmed";
      opponent.last_non_disconnect_status = "result_confirmed";
      opponent.last_opponent_participant_id = claimer.id;
      opponent.updated_at = nextTimestamp(state);
    }

    const table = state.tables[match.table_id];
    table.status = "available";
    table.current_match_id = null;
    table.updated_at = nextTimestamp(state);

    return {
      match_status: match.status,
      dispute_count: match.dispute_count,
    };
  }

  function cancelClaimWin(participantId: string, matchId: string): CancelClaimMatchWinRpcRow {
    const match = getMatch(matchId);
    ensureParticipantInMatch(participantId, match);

    if (match.status !== "winner_claimed") {
      return {
        match_status: match.status,
      };
    }

    const claimerId = match.winner_claimed_by_participant_id;
    if (!claimerId) {
      throw new Error("Match is missing a winner claim");
    }

    if (participantId !== claimerId) {
      throw new Error("Only the claiming participant can cancel the winner claim");
    }

    const claimer = getParticipant(participantId);
    const opponentId = getOpponentId(match, participantId);
    const opponent = opponentId ? getParticipant(opponentId) : null;

    match.status = "in_progress";
    match.winner_claimed_by_participant_id = null;
    match.winner_claimed_at = null;
    match.updated_at = nextTimestamp(state);

    claimer.status = "playing";
    claimer.last_non_disconnect_status = "playing";
    claimer.updated_at = nextTimestamp(state);

    if (opponent) {
      opponent.status = "playing";
      opponent.last_non_disconnect_status = "playing";
      opponent.updated_at = nextTimestamp(state);
    }

    return {
      match_status: match.status,
    };
  }

  function acknowledgeResult(participantId: string) {
    const participant = getParticipant(participantId);

    if (participant.status === "registered") {
      return {
        participant_status: participant.status,
      };
    }

    if (participant.status !== "result_confirmed") {
      throw new Error("Participant is not result_confirmed");
    }

    participant.status = "registered";
    participant.last_non_disconnect_status = "registered";
    participant.current_match_id = null;
    participant.updated_at = nextTimestamp(state);

    return {
      participant_status: participant.status,
    };
  }

  return {
    from(table: "participants" | "matches") {
      return {
        select() {
          const query = {
            eq(column: string, value: string) {
              const record =
                table === "participants"
                  ? (Object.values(state.participants).find(
                      (row) => row[column as keyof ParticipantRow] === value,
                    ) ?? null)
                  : (Object.values(state.matches).find(
                      (row) => row[column as keyof MatchRow] === value,
                    ) ?? null);

              return {
                maybeSingle: () =>
                  Promise.resolve({
                    data: record,
                    error: null,
                  }),
              };
            },
            maybeSingle: () =>
              Promise.resolve({
                data: null,
                error: null,
              }),
          };

          return query;
        },
      };
    },
    rpc(fn: string, args: Record<string, boolean | string>) {
      try {
        let row:
          | ReadyMatchRpcRow
          | CancelMatchBeforeStartRpcRow
          | ClaimMatchWinRpcRow
          | CancelClaimMatchWinRpcRow
          | ApproveMatchResultRpcRow
          | AcknowledgeResultConfirmedRpcRow;

        switch (fn) {
          case "ready_match":
            row = readyMatch(args.p_participant_id as string, args.p_match_id as string);
            break;
          case "cancel_match_before_start":
            row = cancelBeforeStart(args.p_participant_id as string, args.p_match_id as string);
            break;
          case "claim_match_win":
            row = claimWin(args.p_participant_id as string, args.p_match_id as string);
            break;
          case "cancel_claim_match_win":
            row = cancelClaimWin(args.p_participant_id as string, args.p_match_id as string);
            break;
          case "approve_match_result":
            row = approveResult(
              args.p_participant_id as string,
              args.p_match_id as string,
              args.p_approve as boolean,
            );
            break;
          case "acknowledge_result_confirmed":
            row = acknowledgeResult(args.p_participant_id as string);
            break;
          default:
            throw new Error(`Unexpected RPC: ${fn}`);
        }

        return Promise.resolve({
          data: [row],
          error: null,
        });
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

type ReadyMatchRpcRow = Database["public"]["Functions"]["ready_match"]["Returns"][number];
type CancelMatchBeforeStartRpcRow =
  Database["public"]["Functions"]["cancel_match_before_start"]["Returns"][number];
type ClaimMatchWinRpcRow = Database["public"]["Functions"]["claim_match_win"]["Returns"][number];
type CancelClaimMatchWinRpcRow =
  Database["public"]["Functions"]["cancel_claim_match_win"]["Returns"][number];
type ApproveMatchResultRpcRow =
  Database["public"]["Functions"]["approve_match_result"]["Returns"][number];
type AcknowledgeResultConfirmedRpcRow =
  Database["public"]["Functions"]["acknowledge_result_confirmed"]["Returns"][number];

describe("match service", () => {
  let state: FakeState;

  beforeEach(() => {
    state = createDefaultState();
    getSupabaseAdminClient.mockReturnValue(createSupabaseMock(state));
    getParticipantRuntimeState.mockImplementation(async (participantId: string) =>
      buildRuntimeState(state, participantId),
    );
  });

  it("moves from awaiting_ready to in_progress once both players are ready and only creates one bet round", async () => {
    const firstRuntime = await executeReadyMatch({
      participantId: "participant-1",
      matchId: "match-1",
    });

    expect(firstRuntime.status).toBe("ready");
    expect(state.matches["match-1"].status).toBe("awaiting_ready");
    expect(state.chipLedger).toHaveLength(0);

    const secondRuntime = await executeReadyMatch({
      participantId: "participant-2",
      matchId: "match-1",
    });

    expect(secondRuntime.status).toBe("playing");
    expect(state.matches["match-1"].status).toBe("in_progress");
    expect(state.matches["match-1"].started_at).not.toBeNull();
    expect(state.matches["match-1"].agreed_bet_amount).toBe(100);
    expect(state.tables["table-1"].status).toBe("in_use");
    expect(state.chipLedger).toHaveLength(2);
    expect(state.chipLedger.every((entry) => entry.reason === "match_bet")).toBe(true);
    expect(state.participants["participant-1"].chip_balance).toBe(900);
    expect(state.participants["participant-2"].chip_balance).toBe(900);

    await executeReadyMatch({
      participantId: "participant-2",
      matchId: "match-1",
    });

    expect(state.chipLedger).toHaveLength(2);
    expect(state.participants["participant-1"].chip_balance).toBe(900);
    expect(state.participants["participant-2"].chip_balance).toBe(900);
  });

  it("cancels before start and releases the table without touching the ledger", async () => {
    await executeReadyMatch({
      participantId: "participant-1",
      matchId: "match-1",
    });

    await executeCancelBeforeStart({
      participantId: "participant-2",
      matchId: "match-1",
    });

    expect(state.matches["match-1"].status).toBe("cancelled_before_start");
    expect(state.tables["table-1"].status).toBe("available");
    expect(state.tables["table-1"].current_match_id).toBeNull();
    expect(state.participants["participant-1"].status).toBe("registered");
    expect(state.participants["participant-2"].status).toBe("registered");
    expect(state.participants["participant-1"].current_match_id).toBeNull();
    expect(state.participants["participant-2"].current_match_id).toBeNull();
    expect(state.chipLedger).toHaveLength(0);
  });

  it("accepts one winner claim and rejects the second concurrent claim without corrupting state", async () => {
    await executeReadyMatch({
      participantId: "participant-1",
      matchId: "match-1",
    });
    await executeReadyMatch({
      participantId: "participant-2",
      matchId: "match-1",
    });

    const runtime = await executeClaimWin({
      participantId: "participant-1",
      matchId: "match-1",
    });

    expect(runtime.status).toBe("claiming_win");
    expect(state.matches["match-1"].status).toBe("winner_claimed");
    expect(state.matches["match-1"].winner_claimed_by_participant_id).toBe("participant-1");
    expect(state.participants["participant-2"].status).toBe("awaiting_result_approval");

    await expect(
      executeClaimWin({
        participantId: "participant-2",
        matchId: "match-1",
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);

    expect(state.matches["match-1"].winner_claimed_by_participant_id).toBe("participant-1");
    expect(state.participants["participant-1"].status).toBe("claiming_win");
    expect(state.participants["participant-2"].status).toBe("awaiting_result_approval");
    expect(state.chipLedger).toHaveLength(2);
  });

  it("rejects a claimed result back to in_progress without adding ledger entries", async () => {
    await executeReadyMatch({
      participantId: "participant-1",
      matchId: "match-1",
    });
    await executeReadyMatch({
      participantId: "participant-2",
      matchId: "match-1",
    });
    await executeClaimWin({
      participantId: "participant-1",
      matchId: "match-1",
    });

    const ledgerCountBeforeReject = state.chipLedger.length;

    const runtime = await executeApproveResult({
      participantId: "participant-2",
      matchId: "match-1",
      approve: false,
    });

    expect(runtime.status).toBe("playing");
    expect(state.matches["match-1"].status).toBe("in_progress");
    expect(state.matches["match-1"].winner_claimed_by_participant_id).toBeNull();
    expect(state.matches["match-1"].winner_claimed_at).toBeNull();
    expect(state.matches["match-1"].dispute_count).toBe(1);
    expect(state.participants["participant-1"].status).toBe("playing");
    expect(state.participants["participant-2"].status).toBe("playing");
    expect(state.chipLedger).toHaveLength(ledgerCountBeforeReject);
  });

  it("lets the claiming participant cancel their winner claim back to in_progress", async () => {
    await executeReadyMatch({
      participantId: "participant-1",
      matchId: "match-1",
    });
    await executeReadyMatch({
      participantId: "participant-2",
      matchId: "match-1",
    });
    await executeClaimWin({
      participantId: "participant-1",
      matchId: "match-1",
    });

    const runtime = await executeCancelClaimWin({
      participantId: "participant-1",
      matchId: "match-1",
    });

    expect(runtime.status).toBe("playing");
    expect(state.matches["match-1"].status).toBe("in_progress");
    expect(state.matches["match-1"].winner_claimed_by_participant_id).toBeNull();
    expect(state.matches["match-1"].winner_claimed_at).toBeNull();
    expect(state.participants["participant-1"].status).toBe("playing");
    expect(state.participants["participant-2"].status).toBe("playing");
  });

  it("approves a claimed result, pays out the winner, releases the table, and blocks double approval side effects", async () => {
    await executeReadyMatch({
      participantId: "participant-1",
      matchId: "match-1",
    });
    await executeReadyMatch({
      participantId: "participant-2",
      matchId: "match-1",
    });
    await executeClaimWin({
      participantId: "participant-1",
      matchId: "match-1",
    });

    const runtime = await executeApproveResult({
      participantId: "participant-2",
      matchId: "match-1",
      approve: true,
    });

    expect(runtime.status).toBe("result_confirmed");
    expect(state.matches["match-1"].status).toBe("completed");
    expect(state.matches["match-1"].winner_participant_id).toBe("participant-1");
    expect(state.matches["match-1"].completed_at).not.toBeNull();
    expect(state.tables["table-1"].status).toBe("available");
    expect(state.tables["table-1"].current_match_id).toBeNull();
    expect(state.participants["participant-1"].status).toBe("result_confirmed");
    expect(state.participants["participant-2"].status).toBe("result_confirmed");
    expect(state.participants["participant-1"].current_match_id).toBe("match-1");
    expect(state.participants["participant-2"].current_match_id).toBe("match-1");
    expect(state.participants["participant-1"].last_opponent_participant_id).toBe("participant-2");
    expect(state.participants["participant-2"].last_opponent_participant_id).toBe("participant-1");
    expect(state.chipLedger).toHaveLength(3);
    expect(state.chipLedger[2]).toMatchObject({
      participant_id: "participant-1",
      reason: "match_payout",
      delta: 200,
    });
    expect(state.participants["participant-1"].chip_balance).toBe(1100);
    expect(state.participants["participant-2"].chip_balance).toBe(900);

    await executeApproveResult({
      participantId: "participant-2",
      matchId: "match-1",
      approve: true,
    });

    expect(state.chipLedger).toHaveLength(3);
    expect(state.participants["participant-1"].chip_balance).toBe(1100);
    expect(state.participants["participant-2"].chip_balance).toBe(900);
    expect(state.tables["table-1"].status).toBe("available");
  });

  it("acknowledges result_confirmed and clears current_match_id", async () => {
    await executeReadyMatch({
      participantId: "participant-1",
      matchId: "match-1",
    });
    await executeReadyMatch({
      participantId: "participant-2",
      matchId: "match-1",
    });
    await executeClaimWin({
      participantId: "participant-1",
      matchId: "match-1",
    });
    await executeApproveResult({
      participantId: "participant-2",
      matchId: "match-1",
      approve: true,
    });

    const runtime = await acknowledgeResultConfirmed({
      participantId: "participant-1",
    });

    expect(runtime.status).toBe("registered");
    expect(state.participants["participant-1"].status).toBe("registered");
    expect(state.participants["participant-1"].current_match_id).toBeNull();
    expect(state.participants["participant-2"].current_match_id).toBe("match-1");
  });

  it("completes the match through the approval canonical path", async () => {
    await executeReadyMatch({
      participantId: "participant-1",
      matchId: "match-1",
    });
    await executeReadyMatch({
      participantId: "participant-2",
      matchId: "match-1",
    });
    await executeClaimWin({
      participantId: "participant-1",
      matchId: "match-1",
    });

    await completeMatchAndApplyChipLedger({
      matchId: "match-1",
      winnerParticipantId: "participant-1",
    });

    expect(state.matches["match-1"].status).toBe("completed");
    expect(state.matches["match-1"].winner_participant_id).toBe("participant-1");
    expect(state.chipLedger).toHaveLength(3);
  });
});
