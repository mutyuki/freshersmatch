import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/types";

const {
  getSupabaseAdminClient,
  generateParticipantSessionToken,
  hashParticipantSessionToken,
  verifyParticipantSession,
  touchParticipantSession,
  from,
  rpc,
  participantsSelect,
  participantsEq,
  participantsMaybeSingle,
  participantsUpdate,
  participantsUpdateEq,
  participantsUpdateSelect,
  matchesSelect,
  matchesEq,
  matchesMaybeSingle,
  tablesSelect,
  tablesEq,
  tablesMaybeSingle,
  tablesLimit,
  gameRulesSelect,
  gameRulesEq,
  gameRulesMaybeSingle,
  gameRulesIn,
  gameRulesLimit,
  chipLedgerSelect,
  chipLedgerEq,
  chipLedgerNestedEq,
  normalizeParticipantConnectionState,
  restoreDisconnectedParticipantIfNeeded,
} = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  generateParticipantSessionToken: vi.fn(),
  hashParticipantSessionToken: vi.fn(),
  verifyParticipantSession: vi.fn(),
  touchParticipantSession: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  participantsSelect: vi.fn(),
  participantsEq: vi.fn(),
  participantsMaybeSingle: vi.fn(),
  participantsUpdate: vi.fn(),
  participantsUpdateEq: vi.fn(),
  participantsUpdateSelect: vi.fn(),
  matchesSelect: vi.fn(),
  matchesEq: vi.fn(),
  matchesMaybeSingle: vi.fn(),
  tablesSelect: vi.fn(),
  tablesEq: vi.fn(),
  tablesMaybeSingle: vi.fn(),
  tablesLimit: vi.fn(),
  gameRulesSelect: vi.fn(),
  gameRulesEq: vi.fn(),
  gameRulesMaybeSingle: vi.fn(),
  gameRulesIn: vi.fn(),
  gameRulesLimit: vi.fn(),
  chipLedgerSelect: vi.fn(),
  chipLedgerEq: vi.fn(),
  chipLedgerNestedEq: vi.fn(),
  normalizeParticipantConnectionState: vi.fn(),
  restoreDisconnectedParticipantIfNeeded: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

vi.mock("@/lib/auth/participant-session", () => ({
  generateParticipantSessionToken,
  hashParticipantSessionToken,
  verifyParticipantSession,
  touchParticipantSession,
}));

vi.mock("@/lib/services/connection-state-service", () => ({
  normalizeParticipantConnectionState,
  restoreDisconnectedParticipantIfNeeded,
}));

import {
  getParticipantRuntimeState,
  heartbeatParticipant,
  registerParticipant,
  restoreParticipantSession,
} from "@/lib/services/participant-service";

type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type GameRuleRow = Database["public"]["Tables"]["game_rules"]["Row"];
type ChipLedgerRow = Database["public"]["Tables"]["chip_ledger"]["Row"];

const baseParticipant: ParticipantRow = {
  id: "participant-1",
  event_id: "event-1",
  nickname: "Alice",
  status: "registered",
  last_non_disconnect_status: "registered",
  chip_balance: 1500,
  current_match_id: null,
  last_opponent_participant_id: null,
  queued_at: null,
  last_seen_at: "2026-04-10T09:00:00.000Z",
  disqualified_reason: null,
  created_at: "2026-04-10T08:00:00.000Z",
  updated_at: "2026-04-10T09:00:00.000Z",
};

const normalMatch: MatchRow = {
  id: "match-1",
  event_id: "event-1",
  table_id: "table-1",
  player1_participant_id: "participant-1",
  player2_participant_id: "participant-2",
  status: "awaiting_ready",
  is_staff_match: false,
  staff_operator_id: null,
  player1_ready_at: null,
  player2_ready_at: "2026-04-10T09:02:00.000Z",
  player1_turn_role: "first",
  player2_turn_role: "second",
  started_at: null,
  agreed_bet_amount: null,
  dispute_count: 0,
  last_disputed_at: null,
  winner_participant_id: null,
  winner_claimed_by_participant_id: null,
  winner_claimed_at: null,
  completed_at: null,
  cancelled_by_participant_id: null,
  void_reason: null,
  created_at: "2026-04-10T09:00:00.000Z",
  updated_at: "2026-04-10T09:02:00.000Z",
};

const table: TableRow = {
  id: "table-1",
  event_id: "event-1",
  table_number: 3,
  game_title: "Smash Bros",
  game_rule_id: "rule-1",
  status: "reserved",
  current_match_id: "match-1",
  held_by_admin_user_id: null,
  created_at: "2026-04-10T08:00:00.000Z",
  updated_at: "2026-04-10T09:00:00.000Z",
};

const gameRule: GameRuleRow = {
  id: "rule-1",
  event_id: "event-1",
  title: "Smash Bros ルール",
  body: "対戦ルール本文",
  created_at: "2026-04-10T08:00:00.000Z",
  updated_at: "2026-04-10T09:00:00.000Z",
};

function mockParticipantLookup(rows: Record<string, ParticipantRow | null>) {
  participantsMaybeSingle.mockImplementation(() =>
    Promise.resolve({
      data: rows[participantsEq.mock.calls.at(-1)?.[1] ?? ""] ?? null,
      error: null,
    }),
  );
}

describe("participant service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSupabaseAdminClient.mockReturnValue({
      from,
      rpc,
    });

    from.mockImplementation((tableName: string) => {
      if (tableName === "participants") {
        return {
          select: participantsSelect,
          update: participantsUpdate,
        };
      }

      if (tableName === "matches") {
        return {
          select: matchesSelect,
        };
      }

      if (tableName === "tables") {
        return {
          select: tablesSelect,
        };
      }

      if (tableName === "chip_ledger") {
        return {
          select: chipLedgerSelect,
        };
      }

      if (tableName === "game_rules") {
        return {
          select: gameRulesSelect,
        };
      }

      throw new Error(`Unexpected table: ${tableName}`);
    });

    participantsSelect.mockReturnValue({
      eq: participantsEq,
      maybeSingle: participantsMaybeSingle,
    });
    participantsEq.mockReturnValue({
      maybeSingle: participantsMaybeSingle,
      select: participantsUpdateSelect,
    });
    participantsUpdate.mockReturnValue({
      eq: participantsUpdateEq,
    });
    participantsUpdateEq.mockReturnValue({
      select: participantsUpdateSelect,
    });

    matchesSelect.mockReturnValue({
      eq: matchesEq,
    });
    matchesEq.mockReturnValue({
      maybeSingle: matchesMaybeSingle,
    });

    tablesSelect.mockReturnValue({
      eq: tablesEq,
    });
    tablesEq.mockReturnValue({
      maybeSingle: tablesMaybeSingle,
      limit: tablesLimit,
    });

    gameRulesSelect.mockReturnValue({
      eq: gameRulesEq,
      in: gameRulesIn,
    });
    gameRulesEq.mockReturnValue({
      maybeSingle: gameRulesMaybeSingle,
    });
    gameRulesIn.mockReturnValue({
      limit: gameRulesLimit,
    });

    chipLedgerSelect.mockReturnValue({
      eq: chipLedgerEq,
    });
    chipLedgerEq.mockReturnValue({
      eq: chipLedgerNestedEq,
    });

    generateParticipantSessionToken.mockReturnValue("raw-token");
    hashParticipantSessionToken.mockResolvedValue("hashed-token");
    touchParticipantSession.mockResolvedValue(undefined);
    normalizeParticipantConnectionState.mockResolvedValue(undefined);
    restoreDisconnectedParticipantIfNeeded.mockResolvedValue(false);
    gameRulesMaybeSingle.mockResolvedValue({
      data: gameRule,
      error: null,
    });
    gameRulesLimit.mockResolvedValue({
      data: [gameRule],
      error: null,
    });
  });

  it("registers a participant through the RPC and returns the participant row with the raw token", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          participant_id: "participant-1",
          event_id: "event-1",
          session_id: "session-1",
          chip_balance: 1500,
        },
      ],
      error: null,
    });
    mockParticipantLookup({
      "participant-1": baseParticipant,
    });

    await expect(
      registerParticipant({
        venueCode: " VENUE-1 ",
        nickname: " Alice ",
      }),
    ).resolves.toEqual({
      participant: baseParticipant,
      sessionToken: "raw-token",
    });

    expect(generateParticipantSessionToken).toHaveBeenCalledTimes(1);
    expect(hashParticipantSessionToken).toHaveBeenCalledWith("raw-token");
    expect(rpc).toHaveBeenCalledWith("register_participant_and_issue_session", {
      p_venue_code: "VENUE-1",
      p_nickname: "Alice",
      p_session_token_hash: "hashed-token",
    });
  });

  it("maps an invalid venue code RPC error to a 404 app error", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Active event not found for venue code: NOPE",
      },
    });

    await expect(
      registerParticipant({
        venueCode: "NOPE",
        nickname: "Alice",
      }),
    ).rejects.toMatchObject({
      code: "event_not_found",
      status: 404,
    });
  });

  it("maps a duplicate nickname RPC error to a domain conflict", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Participant nickname is already registered in this event: Alice",
      },
    });

    await expect(
      registerParticipant({
        venueCode: "VENUE-1",
        nickname: "Alice",
      }),
    ).rejects.toMatchObject({
      code: "participant_nickname_conflict",
      status: 409,
    });
  });

  it("fails registration when the participant row cannot be reloaded", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          participant_id: "participant-1",
          event_id: "event-1",
          session_id: "session-1",
          chip_balance: 1500,
        },
      ],
      error: null,
    });
    mockParticipantLookup({
      "participant-1": null,
    });

    await expect(
      registerParticipant({
        venueCode: "VENUE-1",
        nickname: "Alice",
      }),
    ).rejects.toMatchObject({
      code: "participant_not_found",
      status: 500,
    });
  });

  it("verifies, touches, and restores the participant runtime from the current state", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    mockParticipantLookup({
      "participant-1": baseParticipant,
    });

    await expect(
      restoreParticipantSession({
        sessionToken: "session-token",
      }),
    ).resolves.toMatchObject({
      restoredConnection: false,
      runtimeState: {
        participantId: "participant-1",
        status: "registered",
        canStartMatching: true,
      },
    });

    expect(verifyParticipantSession).toHaveBeenCalledWith("session-token");
    expect(touchParticipantSession).toHaveBeenCalledWith("session-1");
    expect(restoreDisconnectedParticipantIfNeeded).toHaveBeenCalledWith({
      participantId: "participant-1",
    });
    expect(normalizeParticipantConnectionState).toHaveBeenCalledWith({
      participantId: "participant-1",
      now: expect.any(Date),
    });
  });

  it("returns the minimal registered runtime when there is no current match", async () => {
    mockParticipantLookup({
      "participant-1": baseParticipant,
    });

    await expect(getParticipantRuntimeState("participant-1")).resolves.toEqual({
      participantId: "participant-1",
      eventId: "event-1",
      nickname: "Alice",
      status: "registered",
      lastNonDisconnectStatus: "registered",
      chipBalance: 1500,
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
    expect(normalizeParticipantConnectionState).toHaveBeenCalledWith({
      participantId: "participant-1",
      now: expect.any(Date),
    });
  });

  it("restores disconnected participants when runtime is refreshed without a full reload", async () => {
    participantsMaybeSingle
      .mockResolvedValueOnce({
        data: {
          ...baseParticipant,
          status: "disconnected",
          last_non_disconnect_status: "playing",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          ...baseParticipant,
          status: "playing",
          last_non_disconnect_status: "playing",
          current_match_id: "match-1",
        },
        error: null,
      });
    matchesMaybeSingle.mockResolvedValue({
      data: normalMatch,
      error: null,
    });
    tablesMaybeSingle.mockResolvedValue({
      data: table,
      error: null,
    });
    mockParticipantLookup({
      "participant-2": {
        ...baseParticipant,
        id: "participant-2",
        nickname: "Bob",
      },
    });

    await expect(getParticipantRuntimeState("participant-1")).resolves.toMatchObject({
      status: "playing",
      currentMatchId: "match-1",
    });

    expect(restoreDisconnectedParticipantIfNeeded).toHaveBeenCalledWith({
      participantId: "participant-1",
    });
    expect(normalizeParticipantConnectionState).not.toHaveBeenCalled();
  });

  it("reconstructs a normal match runtime with opponent, table, and opponentReady", async () => {
    mockParticipantLookup({
      "participant-1": {
        ...baseParticipant,
        status: "ready",
        current_match_id: "match-1",
      },
      "participant-2": {
        ...baseParticipant,
        id: "participant-2",
        nickname: "Bob",
      },
    });
    matchesMaybeSingle.mockResolvedValue({
      data: normalMatch,
      error: null,
    });
    tablesMaybeSingle.mockResolvedValue({
      data: table,
      error: null,
    });

    await expect(getParticipantRuntimeState("participant-1")).resolves.toMatchObject({
      currentMatchId: "match-1",
      match: {
        id: "match-1",
        status: "awaiting_ready",
        isStaffMatch: false,
      },
      table: {
        id: "table-1",
        tableNumber: 3,
        gameTitle: "Smash Bros",
        ruleId: "rule-1",
        status: "reserved",
      },
      opponent: {
        participantId: "participant-2",
        nickname: "Bob",
      },
      turnRole: "first",
      opponentReady: true,
      canClaimWin: false,
    });
  });

  it("resolves the participant turn role from the player2 side", async () => {
    mockParticipantLookup({
      "participant-1": {
        ...baseParticipant,
        status: "match_reserved",
        current_match_id: "match-1",
      },
      "participant-2": {
        ...baseParticipant,
        id: "participant-2",
        nickname: "Bob",
      },
    });
    matchesMaybeSingle.mockResolvedValue({
      data: {
        ...normalMatch,
        player1_participant_id: "participant-2",
        player2_participant_id: "participant-1",
        player1_turn_role: "second",
        player2_turn_role: "first",
      },
      error: null,
    });
    tablesMaybeSingle.mockResolvedValue({
      data: table,
      error: null,
    });

    await expect(getParticipantRuntimeState("participant-1")).resolves.toMatchObject({
      turnRole: "first",
      opponent: {
        participantId: "participant-2",
        nickname: "Bob",
      },
    });
  });

  it("reconstructs a staff match runtime with no opponent and claim disabled", async () => {
    mockParticipantLookup({
      "participant-1": {
        ...baseParticipant,
        status: "playing",
        current_match_id: "match-1",
      },
    });
    matchesMaybeSingle.mockResolvedValue({
      data: {
        ...normalMatch,
        player2_participant_id: null,
        status: "in_progress",
        is_staff_match: true,
        staff_operator_id: "admin-1",
        started_at: "2026-04-10T09:05:00.000Z",
        agreed_bet_amount: 100,
      },
      error: null,
    });
    tablesMaybeSingle.mockResolvedValue({
      data: {
        ...table,
        status: "in_use",
      },
      error: null,
    });

    await expect(getParticipantRuntimeState("participant-1")).resolves.toMatchObject({
      opponent: null,
      turnRole: null,
      opponentReady: true,
      canClaimWin: false,
      match: {
        isStaffMatch: true,
        status: "in_progress",
        agreedBetAmount: 100,
      },
    });
  });

  it("computes result delta and resultConfirmedAt for a confirmed result", async () => {
    mockParticipantLookup({
      "participant-1": {
        ...baseParticipant,
        status: "result_confirmed",
        current_match_id: "match-1",
      },
      "participant-2": {
        ...baseParticipant,
        id: "participant-2",
        nickname: "Bob",
      },
    });
    matchesMaybeSingle.mockResolvedValue({
      data: {
        ...normalMatch,
        status: "completed",
        completed_at: "2026-04-10T09:10:00.000Z",
        agreed_bet_amount: 100,
        winner_participant_id: "participant-1",
        winner_claimed_by_participant_id: "participant-1",
      },
      error: null,
    });
    tablesMaybeSingle.mockResolvedValue({
      data: table,
      error: null,
    });
    chipLedgerNestedEq.mockImplementation((column: string, value: string) =>
      Promise.resolve({
        data:
          column === "participant_id" && value === "participant-1"
            ? ([
                {
                  id: "ledger-1",
                  event_id: "event-1",
                  participant_id: "participant-1",
                  match_id: "match-1",
                  delta: -100,
                  reason: "match_bet",
                  balance_after: 1400,
                  created_by_admin_user_id: null,
                  created_at: "2026-04-10T09:05:00.000Z",
                },
                {
                  id: "ledger-3",
                  event_id: "event-1",
                  participant_id: "participant-1",
                  match_id: "match-1",
                  delta: 200,
                  reason: "match_payout",
                  balance_after: 1600,
                  created_by_admin_user_id: null,
                  created_at: "2026-04-10T09:10:00.000Z",
                },
              ] satisfies ChipLedgerRow[])
            : [],
        error: null,
      }),
    );

    await expect(getParticipantRuntimeState("participant-1")).resolves.toMatchObject({
      resultDelta: 100,
      resultConfirmedAt: "2026-04-10T09:10:00.000Z",
      winnerParticipantId: "participant-1",
      winnerClaimedByParticipantId: "participant-1",
    });
    expect(chipLedgerEq).toHaveBeenCalledWith("match_id", "match-1");
    expect(chipLedgerNestedEq).toHaveBeenCalledWith("participant_id", "participant-1");
  });

  it("returns the disqualification reason only for disqualified participants", async () => {
    mockParticipantLookup({
      "participant-1": {
        ...baseParticipant,
        status: "disqualified",
        disqualified_reason: "No-show",
      },
    });

    await expect(getParticipantRuntimeState("participant-1")).resolves.toMatchObject({
      status: "disqualified",
      disqualifiedReason: "No-show",
      canStartMatching: false,
    });
  });

  it("fails when current_match_id points at a missing match", async () => {
    mockParticipantLookup({
      "participant-1": {
        ...baseParticipant,
        current_match_id: "missing-match",
      },
    });
    matchesMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(getParticipantRuntimeState("participant-1")).rejects.toMatchObject({
      code: "match_not_found",
      status: 500,
    });
  });

  it("touches both the session and participant last_seen_at during heartbeat", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    participantsUpdateSelect.mockResolvedValue({
      data: [{ id: "participant-1" }],
      error: null,
    });

    await expect(
      heartbeatParticipant({
        sessionToken: "session-token",
      }),
    ).resolves.toBeUndefined();

    expect(verifyParticipantSession).toHaveBeenCalledWith("session-token");
    expect(touchParticipantSession).toHaveBeenCalledWith("session-1");
    expect(participantsUpdate).toHaveBeenCalledWith({
      last_seen_at: expect.any(String),
    });
    expect(participantsUpdateEq).toHaveBeenCalledWith("id", "participant-1");
  });

  it("fails heartbeat when the participant row cannot be updated", async () => {
    verifyParticipantSession.mockResolvedValue({
      participantId: "participant-1",
      sessionId: "session-1",
    });
    participantsUpdateSelect.mockResolvedValue({
      data: [],
      error: null,
    });

    await expect(
      heartbeatParticipant({
        sessionToken: "session-token",
      }),
    ).rejects.toMatchObject({
      code: "participant_not_found",
      status: 500,
    });
  });
});
