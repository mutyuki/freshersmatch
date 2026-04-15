import type { AdminMatchListItem } from "@/lib/contracts/admin-matches";
import type { AdminTableListItem } from "@/lib/contracts/admin-tables";
import type { GameRuleDetail } from "@/lib/contracts/game-rules";
import { getSupabaseAdminClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { AppError, DomainConflictError } from "@/lib/domain/errors";

type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type GameRuleRow = Database["public"]["Tables"]["game_rules"]["Row"];
type AdminUserRow = Database["public"]["Tables"]["admin_users"]["Row"];

type ForceReleaseTableRpcArgs = Database["public"]["Functions"]["force_release_table"]["Args"];
type ForceReleaseTableRpcRow =
  Database["public"]["Functions"]["force_release_table"]["Returns"][number];
type HoldTableRpcArgs = Database["public"]["Functions"]["hold_table_by_admin"]["Args"];
type HoldTableRpcRow = Database["public"]["Functions"]["hold_table_by_admin"]["Returns"][number];
type ReleaseTableHoldRpcArgs = Database["public"]["Functions"]["release_table_admin_hold"]["Args"];
type ReleaseTableHoldRpcRow =
  Database["public"]["Functions"]["release_table_admin_hold"]["Returns"][number];
type ResolveMatchByAdminRpcArgs = Database["public"]["Functions"]["resolve_match_by_admin"]["Args"];
type ResolveMatchByAdminRpcRow =
  Database["public"]["Functions"]["resolve_match_by_admin"]["Returns"][number];

type QueryResult<TData> = Promise<{
  data: TData;
  error: { message: string } | null;
}>;

type RpcResult<TRow> = Promise<{
  data: TRow[] | null;
  error: { message: string } | null;
}>;

type SelectQuery<TRow> = {
  eq(column: string, value: string): SelectQuery<TRow>;
  in(column: string, values: string[]): SelectQuery<TRow>;
  order(
    column: string,
    options?: {
      ascending?: boolean;
      nullsFirst?: boolean;
    },
  ): SelectQuery<TRow>;
  maybeSingle(): QueryResult<TRow | null>;
  limit(count: number): QueryResult<TRow[] | null>;
};

type TableQuery<TRow> = {
  select(columns: string): SelectQuery<TRow>;
};

type TablesUpdateQuery = {
  eq(
    column: "id",
    value: string,
  ): {
    select(columns: string): {
      maybeSingle(): QueryResult<TableRow | null>;
    };
  };
};

type TablesQuery = TableQuery<TableRow> & {
  update(
    values: Pick<Database["public"]["Tables"]["tables"]["Update"], "game_title" | "game_rule_id">,
  ): TablesUpdateQuery;
};

type GameRulesUpdateQuery = {
  eq(
    column: "id",
    value: string,
  ): {
    select(columns: string): {
      maybeSingle(): QueryResult<GameRuleRow | null>;
    };
  };
};

type GameRulesQuery = TableQuery<GameRuleRow> & {
  insert(
    values: Database["public"]["Tables"]["game_rules"]["Insert"],
  ): {
    select(columns: string): {
      maybeSingle(): QueryResult<GameRuleRow | null>;
    };
  };
  update(
    values: Pick<Database["public"]["Tables"]["game_rules"]["Update"], "title" | "body">,
  ): GameRulesUpdateQuery;
};

type AdminMatchSupabaseClient = {
  from(table: "participants"): TableQuery<ParticipantRow>;
  from(table: "matches"): TableQuery<MatchRow>;
  from(table: "tables"): TablesQuery;
  from(table: "game_rules"): GameRulesQuery;
  from(table: "admin_users"): TableQuery<AdminUserRow>;
  rpc(
    fn: "force_release_table",
    args: ForceReleaseTableRpcArgs,
  ): RpcResult<ForceReleaseTableRpcRow>;
  rpc(fn: "hold_table_by_admin", args: HoldTableRpcArgs): RpcResult<HoldTableRpcRow>;
  rpc(
    fn: "release_table_admin_hold",
    args: ReleaseTableHoldRpcArgs,
  ): RpcResult<ReleaseTableHoldRpcRow>;
  rpc(
    fn: "resolve_match_by_admin",
    args: ResolveMatchByAdminRpcArgs,
  ): RpcResult<ResolveMatchByAdminRpcRow>;
};

export interface AdminMatchMutationResult {
  eventId: string;
  matchId: string | null;
  tableId: string | null;
  participantIds: string[];
  includeRanking: boolean;
}

type AdminResolveMatchInput =
  | {
      type: "void";
    }
  | {
      type: "winner";
      winnerParticipantId: string;
    };

function getAdminMatchSupabaseClient(): AdminMatchSupabaseClient {
  return getSupabaseAdminClient() as unknown as AdminMatchSupabaseClient;
}

async function fetchParticipants(eventId: string): Promise<ParticipantRow[]> {
  const participants = getAdminMatchSupabaseClient().from("participants");
  const { data, error } = await participants
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(1000);

  if (error) {
    throw new AppError("participant_lookup_failed", "Failed to load participants.", 500);
  }

  return data ?? [];
}

async function fetchMatches(eventId: string): Promise<MatchRow[]> {
  const matches = getAdminMatchSupabaseClient().from("matches");
  const { data, error } = await matches
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw new AppError("match_lookup_failed", "Failed to load matches.", 500);
  }

  return data ?? [];
}

async function fetchTables(eventId: string): Promise<TableRow[]> {
  const tables = getAdminMatchSupabaseClient().from("tables");
  const { data, error } = await tables
    .select("*")
    .eq("event_id", eventId)
    .order("table_number", { ascending: true })
    .limit(100);

  if (error) {
    throw new AppError("table_lookup_failed", "Failed to load tables.", 500);
  }

  return data ?? [];
}

async function fetchAdminUsers(adminUserIds: string[]): Promise<Map<string, AdminUserRow>> {
  if (adminUserIds.length === 0) {
    return new Map();
  }

  const adminUsers = getAdminMatchSupabaseClient().from("admin_users");
  const { data, error } = await adminUsers.select("*").in("id", adminUserIds).limit(1000);

  if (error) {
    throw new AppError("admin_user_lookup_failed", "Failed to load admin users.", 500);
  }

  return new Map((data ?? []).map((user) => [user.id, user]));
}

async function fetchGameRules(ruleIds: string[]): Promise<Map<string, GameRuleRow>> {
  if (ruleIds.length === 0) {
    return new Map();
  }

  const gameRules = getAdminMatchSupabaseClient().from("game_rules");
  const { data, error } = await gameRules.select("*").in("id", ruleIds).limit(1000);

  if (error) {
    throw new AppError("game_rule_lookup_failed", "Failed to load game rules.", 500);
  }

  return new Map((data ?? []).map((rule) => [rule.id, rule]));
}

async function fetchTableById(tableId: string): Promise<TableRow> {
  const tables = getAdminMatchSupabaseClient().from("tables");
  const { data, error } = await tables.select("*").eq("id", tableId).maybeSingle();

  if (error) {
    throw new AppError("table_lookup_failed", "Failed to load table.", 500);
  }

  if (!data) {
    throw new AppError("table_not_found", "Table was not found.", 404);
  }

  return data;
}

async function fetchMatchById(matchId: string): Promise<MatchRow> {
  const matches = getAdminMatchSupabaseClient().from("matches");
  const { data, error } = await matches.select("*").eq("id", matchId).maybeSingle();

  if (error) {
    throw new AppError("match_lookup_failed", "Failed to load match.", 500);
  }

  if (!data) {
    throw new AppError("match_not_found", "Match was not found.", 404);
  }

  return data;
}

function getParticipantNickname(
  participantsById: Map<string, ParticipantRow>,
  participantId: string | null,
): string | null {
  if (!participantId) {
    return null;
  }

  return participantsById.get(participantId)?.nickname ?? null;
}

function getMatchParticipantIds(match: MatchRow): string[] {
  return [match.player1_participant_id, match.player2_participant_id].filter(
    (participantId): participantId is string => typeof participantId === "string",
  );
}

function normalizeTableGameTitle(value: string): string {
  const normalized = value.trim();

  if (normalized.length > 0) {
    return normalized;
  }

  throw new AppError(
    "table_game_title_required",
    "Table game title is required.",
    400,
  );
}

function normalizeGameRuleTitle(value: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new AppError("game_rule_title_required", "Game rule title is required.", 400);
  }

  if (normalized.length > 120) {
    throw new AppError("game_rule_title_too_long", "Game rule title is too long.", 400);
  }

  return normalized;
}

function normalizeGameRuleBody(value: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new AppError("game_rule_body_required", "Game rule body is required.", 400);
  }

  return normalized;
}

function normalizeForceReleaseError(message: string): never {
  if (message.includes("Admin user not found")) {
    throw new AppError("admin_user_not_found", "Admin user was not found.", 404);
  }

  if (message.includes("Table not found")) {
    throw new AppError("table_not_found", "Table was not found.", 404);
  }

  if (
    message.includes("Current match not found") ||
    message.includes("Rollback amount must be positive") ||
    message.includes("does not belong to table event")
  ) {
    throw new DomainConflictError(
      "table_force_release_conflict",
      "Table cannot be force released from the current state.",
    );
  }

  throw new AppError("table_force_release_failed", "Failed to force release the table.", 500);
}

function normalizeHoldTableError(message: string): never {
  if (message.includes("Admin user not found")) {
    throw new AppError("admin_user_not_found", "Admin user was not found.", 404);
  }

  if (message.includes("Table not found")) {
    throw new AppError("table_not_found", "Table was not found.", 404);
  }

  if (message.includes("Table cannot be held")) {
    throw new DomainConflictError(
      "table_hold_conflict",
      "Table cannot be moved to admin hold from the current state.",
    );
  }

  throw new AppError("table_hold_failed", "Failed to put the table on admin hold.", 500);
}

function normalizeReleaseTableHoldError(message: string): never {
  if (message.includes("Admin user not found")) {
    throw new AppError("admin_user_not_found", "Admin user was not found.", 404);
  }

  if (message.includes("Table not found")) {
    throw new AppError("table_not_found", "Table was not found.", 404);
  }

  throw new AppError(
    "table_release_hold_failed",
    "Failed to release the table from admin hold.",
    500,
  );
}

function normalizeResolveMatchError(message: string): never {
  if (message.includes("Admin user not found")) {
    throw new AppError("admin_user_not_found", "Admin user was not found.", 404);
  }

  if (message.includes("Match not found")) {
    throw new AppError("match_not_found", "Match was not found.", 404);
  }

  if (message.includes("Table not found")) {
    throw new AppError("table_not_found", "Table for the match was not found.", 404);
  }

  if (
    message.includes("Unsupported admin match resolution type") ||
    message.includes("Winner participant") ||
    message.includes("Staff matches must be resolved") ||
    message.includes("cannot be voided") ||
    message.includes("cannot be force-finished") ||
    message.includes("Started match must have a positive agreed bet amount")
  ) {
    throw new DomainConflictError(
      "admin_match_resolution_conflict",
      "Match cannot be resolved from the current state.",
    );
  }

  throw new AppError("admin_match_resolution_failed", "Failed to resolve the match.", 500);
}

export async function listAdminMatches(eventId: string): Promise<AdminMatchListItem[]> {
  const [participants, matches, tables] = await Promise.all([
    fetchParticipants(eventId),
    fetchMatches(eventId),
    fetchTables(eventId),
  ]);

  const participantsById = new Map(
    participants.map((participant) => [participant.id, participant] as const),
  );
  const tablesById = new Map(tables.map((table) => [table.id, table] as const));

  return matches.map((match) => ({
    matchId: match.id,
    tableNumber: match.table_id ? (tablesById.get(match.table_id)?.table_number ?? null) : null,
    status: match.status,
    participant1Id: match.player1_participant_id,
    participant1Nickname:
      getParticipantNickname(participantsById, match.player1_participant_id) ?? "Unknown",
    participant2Id: match.player2_participant_id,
    participant2Nickname: getParticipantNickname(participantsById, match.player2_participant_id),
    startedAt: match.started_at,
    disputeCount: match.dispute_count,
  }));
}

export async function listAdminTables(eventId: string): Promise<AdminTableListItem[]> {
  const [participants, matches, tables] = await Promise.all([
    fetchParticipants(eventId),
    fetchMatches(eventId),
    fetchTables(eventId),
  ]);

  const participantsById = new Map(
    participants.map((participant) => [participant.id, participant] as const),
  );
  const matchesById = new Map(matches.map((match) => [match.id, match] as const));
  const adminUsersById = await fetchAdminUsers(
    tables
      .map((table) => table.held_by_admin_user_id)
      .filter((adminUserId): adminUserId is string => typeof adminUserId === "string"),
  );
  const gameRulesById = await fetchGameRules(
    tables
      .map((table) => table.game_rule_id)
      .filter((ruleId): ruleId is string => typeof ruleId === "string"),
  );

  return tables.map((table) => {
    const currentMatch = table.current_match_id
      ? (matchesById.get(table.current_match_id) ?? null)
      : null;
    const occupantNicknames =
      currentMatch === null
        ? []
        : [currentMatch.player1_participant_id, currentMatch.player2_participant_id]
            .map((participantId) => getParticipantNickname(participantsById, participantId))
            .filter((nickname): nickname is string => typeof nickname === "string");

    return {
      tableId: table.id,
      tableNumber: table.table_number,
      gameTitle: table.game_title,
      ruleId: table.game_rule_id,
      ruleTitle: table.game_rule_id ? (gameRulesById.get(table.game_rule_id)?.title ?? null) : null,
      hasRule: table.game_rule_id !== null && gameRulesById.has(table.game_rule_id),
      status: table.status,
      currentMatchId: table.current_match_id,
      occupantNicknames,
      heldByAdminDisplayName: table.held_by_admin_user_id
        ? (adminUsersById.get(table.held_by_admin_user_id)?.display_name ?? null)
        : null,
    };
  });
}

export async function updateTableGameTitle(params: {
  tableId: string;
  gameTitle: string;
}): Promise<AdminMatchMutationResult> {
  const gameTitle = normalizeTableGameTitle(params.gameTitle);
  const table = await fetchTableById(params.tableId);
  const currentMatch = table.current_match_id ? await fetchMatchById(table.current_match_id) : null;

  const tables = getAdminMatchSupabaseClient().from("tables");
  const { data, error } = await tables
    .update({
      game_title: gameTitle,
    })
    .eq("id", table.id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new AppError(
      "table_game_title_update_failed",
      "Failed to update table game title.",
      500,
    );
  }

  if (!data) {
    throw new AppError("table_not_found", "Table was not found.", 404);
  }

  return {
    eventId: table.event_id,
    matchId: currentMatch?.id ?? null,
    tableId: table.id,
    participantIds: currentMatch ? getMatchParticipantIds(currentMatch) : [],
    includeRanking: false,
  };
}

export async function updateTableRule(params: {
  tableId: string;
  title: string;
  body: string;
}): Promise<AdminMatchMutationResult> {
  const title = normalizeGameRuleTitle(params.title);
  const body = normalizeGameRuleBody(params.body);
  const table = await fetchTableById(params.tableId);
  const currentMatch = table.current_match_id ? await fetchMatchById(table.current_match_id) : null;
  const gameRules = getAdminMatchSupabaseClient().from("game_rules");

  let rule: GameRuleRow | null = null;

  if (table.game_rule_id) {
    const { data, error } = await gameRules
      .update({
        title,
        body,
      })
      .eq("id", table.game_rule_id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new AppError("game_rule_update_failed", "Failed to update game rule.", 500);
    }

    rule = data;
  } else {
    const { data, error } = await gameRules
      .insert({
        event_id: table.event_id,
        title,
        body,
      })
      .select("*")
      .maybeSingle();

    if (error) {
      throw new AppError("game_rule_create_failed", "Failed to create game rule.", 500);
    }

    rule = data;
  }

  if (!rule) {
    throw new AppError("game_rule_write_failed", "Game rule write returned no result.", 500);
  }

  if (!table.game_rule_id) {
    const tables = getAdminMatchSupabaseClient().from("tables");
    const { error } = await tables
      .update({
        game_rule_id: rule.id,
      })
      .eq("id", table.id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new AppError("table_rule_assign_failed", "Failed to assign game rule to table.", 500);
    }
  }

  return {
    eventId: table.event_id,
    matchId: currentMatch?.id ?? null,
    tableId: table.id,
    participantIds: currentMatch ? getMatchParticipantIds(currentMatch) : [],
    includeRanking: false,
  };
}

export async function getAdminTableRule(tableId: string): Promise<GameRuleDetail | null> {
  const table = await fetchTableById(tableId);

  if (!table.game_rule_id) {
    return null;
  }

  const gameRules = await fetchGameRules([table.game_rule_id]);
  const rule = gameRules.get(table.game_rule_id);

  if (!rule) {
    throw new AppError("game_rule_not_found", "Game rule was not found.", 404);
  }

  return {
    id: rule.id,
    title: rule.title,
    body: rule.body,
    updatedAt: rule.updated_at,
  };
}

export async function forceReleaseTable(params: {
  adminUserId: string;
  tableId: string;
}): Promise<AdminMatchMutationResult> {
  const table = await fetchTableById(params.tableId);
  const currentMatch = table.current_match_id ? await fetchMatchById(table.current_match_id) : null;

  const { data, error } = await getAdminMatchSupabaseClient().rpc("force_release_table", {
    p_admin_user_id: params.adminUserId,
    p_table_id: params.tableId,
  });

  if (error) {
    normalizeForceReleaseError(error.message);
  }

  if (!data?.[0]) {
    throw new AppError("table_force_release_failed", "Force release RPC returned no result.", 500);
  }

  return {
    eventId: table.event_id,
    matchId: data[0].affected_match_id ?? currentMatch?.id ?? null,
    tableId: table.id,
    participantIds: currentMatch ? getMatchParticipantIds(currentMatch) : [],
    includeRanking: false,
  };
}

export async function holdTable(params: {
  adminUserId: string;
  tableId: string;
}): Promise<AdminMatchMutationResult> {
  const table = await fetchTableById(params.tableId);
  const { data, error } = await getAdminMatchSupabaseClient().rpc("hold_table_by_admin", {
    p_admin_user_id: params.adminUserId,
    p_table_id: params.tableId,
  });

  if (error) {
    normalizeHoldTableError(error.message);
  }

  if (!data?.[0]) {
    throw new AppError("table_hold_failed", "Hold table RPC returned no result.", 500);
  }

  return {
    eventId: table.event_id,
    matchId: null,
    tableId: table.id,
    participantIds: [],
    includeRanking: false,
  };
}

export async function releaseTableHold(params: {
  adminUserId: string;
  tableId: string;
}): Promise<AdminMatchMutationResult> {
  const table = await fetchTableById(params.tableId);
  const { data, error } = await getAdminMatchSupabaseClient().rpc("release_table_admin_hold", {
    p_admin_user_id: params.adminUserId,
    p_table_id: params.tableId,
  });

  if (error) {
    normalizeReleaseTableHoldError(error.message);
  }

  if (!data?.[0]) {
    throw new AppError(
      "table_release_hold_failed",
      "Release table hold RPC returned no result.",
      500,
    );
  }

  return {
    eventId: table.event_id,
    matchId: null,
    tableId: table.id,
    participantIds: [],
    includeRanking: false,
  };
}

export async function resolveMatchByAdmin(params: {
  adminUserId: string;
  matchId: string;
  resolution: AdminResolveMatchInput;
}): Promise<AdminMatchMutationResult> {
  const match = await fetchMatchById(params.matchId);

  const { data, error } = await getAdminMatchSupabaseClient().rpc("resolve_match_by_admin", {
    p_admin_user_id: params.adminUserId,
    p_match_id: params.matchId,
    p_resolution_type: params.resolution.type,
    p_winner_participant_id:
      params.resolution.type === "winner" ? params.resolution.winnerParticipantId : null,
  });

  if (error) {
    normalizeResolveMatchError(error.message);
  }

  if (!data?.[0]) {
    throw new AppError(
      "admin_match_resolution_failed",
      "Resolve match RPC returned no result.",
      500,
    );
  }

  return {
    eventId: match.event_id,
    matchId: match.id,
    tableId: match.table_id,
    participantIds: getMatchParticipantIds(match),
    includeRanking: params.resolution.type === "winner",
  };
}
