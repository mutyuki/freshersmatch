import { getSupabaseAdminClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { AppError, DomainConflictError } from "@/lib/domain/errors";

type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];

type StartStaffMatchRpcArgs = Database["public"]["Functions"]["start_staff_match"]["Args"];
type StartStaffMatchRpcRow =
  Database["public"]["Functions"]["start_staff_match"]["Returns"][number];
type ResolveStaffMatchRpcArgs = Database["public"]["Functions"]["resolve_staff_match"]["Args"];
type ResolveStaffMatchRpcRow =
  Database["public"]["Functions"]["resolve_staff_match"]["Returns"][number];

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
  maybeSingle(): QueryResult<TRow | null>;
};

type TableQuery<TRow> = {
  select(columns: string): SelectQuery<TRow>;
};

type StaffMatchSupabaseClient = {
  from(table: "participants"): TableQuery<ParticipantRow>;
  from(table: "matches"): TableQuery<MatchRow>;
  from(table: "tables"): TableQuery<TableRow>;
  rpc(fn: "start_staff_match", args: StartStaffMatchRpcArgs): RpcResult<StartStaffMatchRpcRow>;
  rpc(
    fn: "resolve_staff_match",
    args: ResolveStaffMatchRpcArgs,
  ): RpcResult<ResolveStaffMatchRpcRow>;
};

export interface StaffMatchMutationResult {
  eventId: string;
  matchId: string;
  tableId: string;
  participantIds: string[];
  includeRanking: boolean;
}

function getStaffMatchSupabaseClient(): StaffMatchSupabaseClient {
  return getSupabaseAdminClient() as unknown as StaffMatchSupabaseClient;
}

async function fetchParticipantById(participantId: string): Promise<ParticipantRow> {
  const participants = getStaffMatchSupabaseClient().from("participants");
  const { data, error } = await participants.select("*").eq("id", participantId).maybeSingle();

  if (error) {
    throw new AppError("participant_lookup_failed", "Failed to load participant.", 500);
  }

  if (!data) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  return data;
}

async function fetchMatchById(matchId: string): Promise<MatchRow> {
  const matches = getStaffMatchSupabaseClient().from("matches");
  const { data, error } = await matches.select("*").eq("id", matchId).maybeSingle();

  if (error) {
    throw new AppError("match_lookup_failed", "Failed to load match.", 500);
  }

  if (!data) {
    throw new AppError("match_not_found", "Match was not found.", 404);
  }

  return data;
}

async function fetchTableById(tableId: string): Promise<TableRow> {
  const tables = getStaffMatchSupabaseClient().from("tables");
  const { data, error } = await tables.select("*").eq("id", tableId).maybeSingle();

  if (error) {
    throw new AppError("table_lookup_failed", "Failed to load table.", 500);
  }

  if (!data) {
    throw new AppError("table_not_found", "Table was not found.", 404);
  }

  return data;
}

function normalizeStartStaffMatchError(message: string): never {
  if (message.includes("Admin user not found")) {
    throw new AppError("admin_user_not_found", "Admin user was not found.", 404);
  }

  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (message.includes("Table not found")) {
    throw new AppError("table_not_found", "Table was not found.", 404);
  }

  if (
    message.includes("not queueing") ||
    message.includes("active match") ||
    message.includes("positive chip balance") ||
    message.includes("not available") ||
    message.includes("No available table found")
  ) {
    throw new DomainConflictError(
      "staff_match_start_conflict",
      "Staff match cannot be started from the current state.",
    );
  }

  throw new AppError("staff_match_start_failed", "Failed to start the staff match.", 500);
}

function normalizeResolveStaffMatchError(message: string): never {
  if (message.includes("Admin user not found")) {
    throw new AppError("admin_user_not_found", "Admin user was not found.", 404);
  }

  if (message.includes("Match not found")) {
    throw new AppError("match_not_found", "Match was not found.", 404);
  }

  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (message.includes("Table not found")) {
    throw new AppError("table_not_found", "Table was not found.", 404);
  }

  if (
    message.includes("not a staff match") ||
    message.includes("cannot be resolved") ||
    message.includes("not resolvable") ||
    message.includes("positive agreed bet amount")
  ) {
    throw new DomainConflictError(
      "staff_match_resolution_conflict",
      "Staff match cannot be resolved from the current state.",
    );
  }

  throw new AppError("staff_match_resolution_failed", "Failed to resolve the staff match.", 500);
}

export async function startStaffMatch(params: {
  adminUserId: string;
  participantId: string;
  optionalTableId?: string;
}): Promise<StaffMatchMutationResult> {
  const participant = await fetchParticipantById(params.participantId);

  if (params.optionalTableId) {
    await fetchTableById(params.optionalTableId);
  }

  const { data, error } = await getStaffMatchSupabaseClient().rpc("start_staff_match", {
    p_admin_user_id: params.adminUserId,
    p_participant_id: params.participantId,
    p_table_id: params.optionalTableId ?? null,
  });

  if (error) {
    normalizeStartStaffMatchError(error.message);
  }

  const matchId = data?.[0]?.match_id;

  if (!matchId) {
    throw new AppError(
      "staff_match_start_failed",
      "Start staff match RPC returned no result.",
      500,
    );
  }

  const match = await fetchMatchById(matchId);

  return {
    eventId: participant.event_id,
    matchId: match.id,
    tableId: match.table_id,
    participantIds: [participant.id],
    includeRanking: false,
  };
}

export async function resolveStaffMatch(params: {
  adminUserId: string;
  matchId: string;
  participantWon: boolean;
}): Promise<StaffMatchMutationResult> {
  const match = await fetchMatchById(params.matchId);

  const { data, error } = await getStaffMatchSupabaseClient().rpc("resolve_staff_match", {
    p_admin_user_id: params.adminUserId,
    p_match_id: params.matchId,
    p_participant_won: params.participantWon,
  });

  if (error) {
    normalizeResolveStaffMatchError(error.message);
  }

  if (!data?.[0]) {
    throw new AppError(
      "staff_match_resolution_failed",
      "Resolve staff match RPC returned no result.",
      500,
    );
  }

  return {
    eventId: match.event_id,
    matchId: match.id,
    tableId: match.table_id,
    participantIds: [match.player1_participant_id],
    includeRanking: true,
  };
}
