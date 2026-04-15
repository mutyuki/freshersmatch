import {
  generateParticipantSessionToken,
  hashParticipantSessionToken,
  touchParticipantSession,
  verifyParticipantSession,
} from "@/lib/auth/participant-session";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";
import type {
  CurrentTableGameRule,
  GameRuleSummary,
  TableGameRuleDetail,
} from "@/lib/contracts/game-rules";
import { getSupabaseAdminClient } from "@/lib/db/server";
import type { ChipLedgerReason, Database } from "@/lib/db/types";
import { AppError, DomainConflictError } from "@/lib/domain/errors";
import {
  normalizeParticipantConnectionState,
  restoreDisconnectedParticipantIfNeeded,
} from "@/lib/services/connection-state-service";

type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type GameRuleRow = Database["public"]["Tables"]["game_rules"]["Row"];
type ChipLedgerRow = Database["public"]["Tables"]["chip_ledger"]["Row"];
type RegisterParticipantRpcRow =
  Database["public"]["Functions"]["register_participant_and_issue_session"]["Returns"][number];

type QueryResult<TData> = Promise<{
  data: TData;
  error: { message: string } | null;
}>;

type RpcResult<TRow> = Promise<{
  data: TRow[] | null;
  error: { message: string } | null;
}>;

type ParticipantsTableQuery = {
  select(columns: string): {
    eq(
      column: "id" | "event_id",
      value: string,
    ): {
      maybeSingle(): QueryResult<ParticipantRow | null>;
      select?(columns: string): QueryResult<ParticipantRow[] | null>;
    };
    maybeSingle(): QueryResult<ParticipantRow | null>;
    select?(columns: string): QueryResult<ParticipantRow[] | null>;
  };
  update(values: Pick<Database["public"]["Tables"]["participants"]["Update"], "last_seen_at">): {
    eq(
      column: "id",
      value: string,
    ): {
      select(columns: "id"): QueryResult<Array<Pick<ParticipantRow, "id">> | null>;
    };
  };
};

type MatchesTableQuery = {
  select(columns: string): {
    eq(
      column: "id",
      value: string,
    ): {
      maybeSingle(): QueryResult<MatchRow | null>;
    };
  };
};

type TablesTableQuery = {
  select(columns: string): {
    eq(
      column: "id" | "event_id",
      value: string,
    ): {
      maybeSingle(): QueryResult<TableRow | null>;
      limit(count: number): QueryResult<TableRow[] | null>;
    };
  };
};

type GameRulesTableQuery = {
  select(columns: string): {
    eq(column: "id" | "event_id", value: string): {
      maybeSingle(): QueryResult<GameRuleRow | null>;
      order?(
        column: "updated_at" | "title",
        options?: {
          ascending?: boolean;
        },
      ): {
        limit(count: number): QueryResult<GameRuleRow[] | null>;
      };
    };
    in?(
      column: "id",
      values: string[],
    ): {
      limit(count: number): QueryResult<GameRuleRow[] | null>;
    };
  };
};

type ChipLedgerParticipantFilterQuery = {
  eq(column: "participant_id", value: string): QueryResult<ChipLedgerRow[] | null>;
};

type ChipLedgerTableQuery = {
  select(columns: string): {
    eq(column: "match_id", value: string): ChipLedgerParticipantFilterQuery;
  };
};

type ParticipantServiceSupabaseClient = {
  from(table: "participants"): ParticipantsTableQuery;
  from(table: "matches"): MatchesTableQuery;
  from(table: "tables"): TablesTableQuery;
  from(table: "game_rules"): GameRulesTableQuery;
  from(table: "chip_ledger"): ChipLedgerTableQuery;
  rpc(
    fn: "register_participant_and_issue_session",
    args: Database["public"]["Functions"]["register_participant_and_issue_session"]["Args"],
  ): RpcResult<RegisterParticipantRpcRow>;
};

function getParticipantServiceSupabaseClient(): ParticipantServiceSupabaseClient {
  return getSupabaseAdminClient() as unknown as ParticipantServiceSupabaseClient;
}

function normalizeRequiredText(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (normalized.length > 0) {
    return normalized;
  }

  throw new AppError(
    `${fieldName}_required`,
    `${fieldName === "venueCode" ? "Venue code" : "Nickname"} is required.`,
    400,
  );
}

function normalizeRegisterRpcError(message: string): never {
  if (message.includes("Active event not found for venue code")) {
    throw new AppError("event_not_found", "Active event was not found for the venue code.", 404);
  }

  if (message.includes("Participant nickname is already registered")) {
    throw new DomainConflictError(
      "participant_nickname_conflict",
      "Participant nickname is already registered in this event.",
    );
  }

  throw new AppError("participant_register_failed", "Failed to register participant.", 500);
}

async function fetchParticipantById(participantId: string): Promise<ParticipantRow> {
  const participants = getParticipantServiceSupabaseClient().from("participants");
  const { data, error } = await participants.select("*").eq("id", participantId).maybeSingle();

  if (error) {
    throw new AppError("participant_lookup_failed", "Failed to load participant.", 500);
  }

  if (!data) {
    throw new AppError("participant_not_found", "Participant was not found.", 500);
  }

  return data;
}

async function fetchMatchById(matchId: string): Promise<MatchRow> {
  const matches = getParticipantServiceSupabaseClient().from("matches");
  const { data, error } = await matches.select("*").eq("id", matchId).maybeSingle();

  if (error) {
    throw new AppError("match_lookup_failed", "Failed to load current match.", 500);
  }

  if (!data) {
    throw new AppError("match_not_found", "Current match was not found for participant.", 500);
  }

  return data;
}

async function fetchTableById(tableId: string): Promise<TableRow> {
  const tables = getParticipantServiceSupabaseClient().from("tables");
  const { data, error } = await tables.select("*").eq("id", tableId).maybeSingle();

  if (error) {
    throw new AppError("table_lookup_failed", "Failed to load table.", 500);
  }

  if (!data) {
    throw new AppError("table_not_found", "Current table was not found for match.", 500);
  }

  return data;
}

async function fetchTablesByEventId(eventId: string): Promise<TableRow[]> {
  const tables = getParticipantServiceSupabaseClient().from("tables");
  const { data, error } = await tables.select("*").eq("event_id", eventId).limit(100);

  if (error) {
    throw new AppError("table_lookup_failed", "Failed to load event tables.", 500);
  }

  return (data ?? []).sort((left, right) => left.table_number - right.table_number);
}

async function fetchGameRuleById(ruleId: string): Promise<GameRuleRow> {
  const gameRules = getParticipantServiceSupabaseClient().from("game_rules");
  const { data, error } = await gameRules.select("*").eq("id", ruleId).maybeSingle();

  if (error) {
    throw new AppError("game_rule_lookup_failed", "Failed to load game rule.", 500);
  }

  if (!data) {
    throw new AppError("game_rule_not_found", "Game rule was not found.", 404);
  }

  return data;
}

async function fetchGameRulesByIds(ruleIds: string[]): Promise<Map<string, GameRuleRow>> {
  if (ruleIds.length === 0) {
    return new Map();
  }

  const gameRules = getParticipantServiceSupabaseClient().from("game_rules");
  const selectQuery = gameRules.select("*");
  const { data, error } = await selectQuery.in?.("id", ruleIds).limit(100) ?? {
    data: null,
    error: { message: "Game rule id lookup is not supported." },
  };

  if (error) {
    throw new AppError("game_rule_lookup_failed", "Failed to load game rules.", 500);
  }

  return new Map((data ?? []).map((rule) => [rule.id, rule]));
}

async function fetchResultDelta(matchId: string, participantId: string): Promise<number | null> {
  const chipLedger = getParticipantServiceSupabaseClient().from("chip_ledger");
  const { data, error } = await chipLedger
    .select("*")
    .eq("match_id", matchId)
    .eq("participant_id", participantId);

  if (error) {
    throw new AppError(
      "chip_ledger_lookup_failed",
      "Failed to load chip ledger entries for result.",
      500,
    );
  }

  if (!data || data.length === 0) {
    return 0;
  }

  const relevantReasons = new Set<ChipLedgerReason>(["match_bet", "match_payout"]);
  return data.reduce((sum: number, entry: ChipLedgerRow) => {
    if (!relevantReasons.has(entry.reason)) {
      return sum;
    }

    return sum + entry.delta;
  }, 0);
}

async function buildParticipantRuntimeState(
  participant: ParticipantRow,
): Promise<ParticipantRuntimeState> {
  let match: MatchRow | null = null;
  let table: TableRow | null = null;
  let opponent: ParticipantRow | null = null;
  let turnRole: ParticipantRuntimeState["turnRole"] = null;

  if (participant.current_match_id) {
    match = await fetchMatchById(participant.current_match_id);
    table = await fetchTableById(match.table_id);
    turnRole = match.is_staff_match
      ? null
      : match.player1_participant_id === participant.id
        ? match.player1_turn_role
        : match.player2_turn_role;

    if (!match.is_staff_match) {
      const opponentParticipantId =
        match.player1_participant_id === participant.id
          ? match.player2_participant_id
          : match.player1_participant_id;

      if (!opponentParticipantId) {
        throw new AppError(
          "participant_runtime_invalid",
          "Current match is missing an opponent.",
          500,
        );
      }

      opponent = await fetchParticipantById(opponentParticipantId);
    }
  }

  const resultDelta =
    participant.status === "result_confirmed" && participant.current_match_id
      ? await fetchResultDelta(participant.current_match_id, participant.id)
      : null;

  const canStartMatching = participant.status === "registered" && participant.chip_balance > 0;
  const canClaimWin = participant.status === "playing" && match !== null && !match.is_staff_match;
  const opponentReady =
    match === null
      ? false
      : match.is_staff_match
        ? true
        : match.status === "awaiting_ready" && participant.status !== "match_reserved";

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
    opponentReady,
    winnerParticipantId: match?.winner_participant_id ?? null,
    winnerClaimedByParticipantId: match?.winner_claimed_by_participant_id ?? null,
    disqualifiedReason:
      participant.status === "disqualified" ? participant.disqualified_reason : null,
    resultDelta,
    resultConfirmedAt: match?.completed_at ?? null,
    canStartMatching,
    canClaimWin,
  };
}

export async function registerParticipant(params: {
  venueCode: string;
  nickname: string;
}): Promise<{ participant: ParticipantRow; sessionToken: string }> {
  const venueCode = normalizeRequiredText(params.venueCode, "venueCode");
  const nickname = normalizeRequiredText(params.nickname, "nickname");
  const sessionToken = generateParticipantSessionToken();
  const sessionTokenHash = await hashParticipantSessionToken(sessionToken);
  const supabase = getParticipantServiceSupabaseClient();

  const { data, error } = await supabase.rpc("register_participant_and_issue_session", {
    p_venue_code: venueCode,
    p_nickname: nickname,
    p_session_token_hash: sessionTokenHash,
  });

  if (error) {
    normalizeRegisterRpcError(error.message);
  }

  const registeredParticipant = data?.[0];

  if (!registeredParticipant) {
    throw new AppError(
      "participant_register_failed",
      "Participant registration did not return a participant.",
      500,
    );
  }

  const participant = await fetchParticipantById(registeredParticipant.participant_id);

  return {
    participant,
    sessionToken,
  };
}

export async function restoreParticipantSession(params: { sessionToken: string }): Promise<{
  runtimeState: ParticipantRuntimeState;
  restoredConnection: boolean;
}> {
  const { participantId, sessionId } = await verifyParticipantSession(params.sessionToken);
  await touchParticipantSession(sessionId);
  const restoredConnection = await restoreDisconnectedParticipantIfNeeded({ participantId });

  return {
    runtimeState: await getParticipantRuntimeState(participantId),
    restoredConnection,
  };
}

export async function getParticipantRuntimeState(
  participantId: string,
): Promise<ParticipantRuntimeState> {
  const participantBeforeNormalization = await fetchParticipantById(participantId);

  if (participantBeforeNormalization.status === "disconnected") {
    await restoreDisconnectedParticipantIfNeeded({ participantId });
  } else {
    await normalizeParticipantConnectionState({
      participantId,
      now: new Date(),
    });
  }

  const participant = await fetchParticipantById(participantId);
  return buildParticipantRuntimeState(participant);
}

export async function heartbeatParticipant(params: { sessionToken: string }): Promise<void> {
  const { participantId, sessionId } = await verifyParticipantSession(params.sessionToken);
  await touchParticipantSession(sessionId);

  const participants = getParticipantServiceSupabaseClient().from("participants");
  const { data, error } = await participants
    .update({
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", participantId)
    .select("id");

  if (error) {
    throw new AppError(
      "participant_heartbeat_failed",
      "Failed to update participant heartbeat.",
      500,
    );
  }

  if (!data || data.length === 0) {
    throw new AppError("participant_not_found", "Participant was not found.", 500);
  }
}

function toGameRuleDetail(rule: GameRuleRow) {
  return {
    id: rule.id,
    title: rule.title,
    body: rule.body,
    updatedAt: rule.updated_at,
  };
}

export async function getParticipantCurrentRule(
  participantId: string,
): Promise<CurrentTableGameRule> {
  const runtimeState = await getParticipantRuntimeState(participantId);

  if (!runtimeState.table) {
    throw new AppError("participant_table_not_found", "Participant is not assigned to a table.", 404);
  }

  if (!runtimeState.table.ruleId) {
    throw new AppError("game_rule_not_found", "No game rule is configured for the current table.", 404);
  }

  const rule = await fetchGameRuleById(runtimeState.table.ruleId);

  return {
    tableId: runtimeState.table.id,
    tableNumber: runtimeState.table.tableNumber,
    gameTitle: runtimeState.table.gameTitle,
    rule: toGameRuleDetail(rule),
  };
}

export async function listParticipantGameRules(participantId: string): Promise<GameRuleSummary[]> {
  const participant = await fetchParticipantById(participantId);
  const tables = await fetchTablesByEventId(participant.event_id);
  const ruleIds = tables
    .map((table) => table.game_rule_id)
    .filter((ruleId): ruleId is string => typeof ruleId === "string");
  const rulesById = await fetchGameRulesByIds(ruleIds);

  return tables
    .filter((table) => table.game_rule_id && rulesById.has(table.game_rule_id))
    .map((table) => ({
      tableId: table.id,
      tableNumber: table.table_number,
      gameTitle: table.game_title,
      ruleTitle: rulesById.get(table.game_rule_id as string)?.title ?? table.game_title,
    }));
}

export async function getParticipantRuleByTableId(
  participantId: string,
  tableId: string,
): Promise<TableGameRuleDetail> {
  const participant = await fetchParticipantById(participantId);
  const table = await fetchTableById(tableId);

  if (table.event_id !== participant.event_id) {
    throw new AppError("table_not_found", "Table was not found.", 404);
  }

  if (!table.game_rule_id) {
    throw new AppError("game_rule_not_found", "No game rule is configured for this table.", 404);
  }

  const rule = await fetchGameRuleById(table.game_rule_id);

  return {
    tableId: table.id,
    tableNumber: table.table_number,
    gameTitle: table.game_title,
    rule: toGameRuleDetail(rule),
  };
}
