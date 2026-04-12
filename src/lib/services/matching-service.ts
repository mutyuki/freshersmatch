import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";
import { getSupabaseAdminClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { AppError, DomainConflictError } from "@/lib/domain/errors";
import { getParticipantRuntimeState } from "@/lib/services/participant-service";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type StartQueueRpcArgs = Database["public"]["Functions"]["start_queue_and_try_match"]["Args"];
type StartQueueRpcRow =
  Database["public"]["Functions"]["start_queue_and_try_match"]["Returns"][number];
type CancelQueueRpcRow = Database["public"]["Functions"]["cancel_queue"]["Returns"][number];

type QueryResult<TData> = Promise<{
  data: TData;
  error: { message: string } | null;
}>;

type RpcResult<TRow> = Promise<{
  data: TRow[] | null;
  error: { message: string } | null;
}>;

type TableSelectQuery<TRow> = {
  eq(column: string, value: string): TableSelectQuery<TRow>;
  gt(column: string, value: number): TableSelectQuery<TRow>;
  is(column: string, value: null): TableSelectQuery<TRow>;
  order(
    column: string,
    options?: {
      ascending?: boolean;
      nullsFirst?: boolean;
    },
  ): TableSelectQuery<TRow>;
  limit(count: number): QueryResult<TRow[] | null>;
  maybeSingle(): QueryResult<TRow | null>;
};

type TableQuery<TRow> = {
  select(columns: string): TableSelectQuery<TRow>;
};

type MatchingServiceSupabaseClient = {
  from(table: "events"): TableQuery<EventRow>;
  from(table: "participants"): TableQuery<ParticipantRow>;
  from(table: "tables"): TableQuery<TableRow>;
  from(table: "matches"): TableQuery<MatchRow>;
  rpc(fn: "start_queue_and_try_match", args: StartQueueRpcArgs): RpcResult<StartQueueRpcRow>;
  rpc(
    fn: "cancel_queue",
    args: Database["public"]["Functions"]["cancel_queue"]["Args"],
  ): RpcResult<CancelQueueRpcRow>;
};

function getMatchingServiceSupabaseClient(): MatchingServiceSupabaseClient {
  return getSupabaseAdminClient() as unknown as MatchingServiceSupabaseClient;
}

function normalizeStartQueueError(message: string): never {
  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (message.includes("Active event not found")) {
    throw new AppError("active_event_not_found", "Active event was not found.", 404);
  }

  if (
    message.includes("Participant is not in registered status") ||
    message.includes("Participant is not in queueable status")
  ) {
    throw new DomainConflictError(
      "participant_status_conflict",
      "Participant must be registered before starting matching.",
    );
  }

  if (message.includes("Participant already has an active match")) {
    throw new DomainConflictError(
      "participant_match_conflict",
      "Participant already has an active match.",
    );
  }

  if (message.includes("Participant chip balance must be positive")) {
    throw new DomainConflictError(
      "participant_chip_balance_conflict",
      "Participant chip balance must be positive to start matching.",
    );
  }

  throw new AppError("matching_start_failed", "Failed to start matching.", 500);
}

function normalizeCancelQueueError(message: string): never {
  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (message.includes("Participant is not queueing")) {
    throw new DomainConflictError(
      "participant_status_conflict",
      "Participant must be queueing before cancelling matching.",
    );
  }

  throw new AppError("matching_cancel_failed", "Failed to cancel matching.", 500);
}

async function fetchActiveEventById(eventId: string): Promise<EventRow> {
  const events = getMatchingServiceSupabaseClient().from("events");
  const { data, error } = await events.select("*").eq("id", eventId).maybeSingle();

  if (error) {
    throw new AppError("active_event_lookup_failed", "Failed to load active event.", 500);
  }

  if (!data || data.status !== "active") {
    throw new AppError("active_event_not_found", "Active event was not found.", 404);
  }

  return data;
}

async function fetchParticipantById(participantId: string): Promise<ParticipantRow> {
  const participants = getMatchingServiceSupabaseClient().from("participants");
  const { data, error } = await participants.select("*").eq("id", participantId).maybeSingle();

  if (error) {
    throw new AppError("participant_lookup_failed", "Failed to load participant.", 500);
  }

  if (!data) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  return data;
}

async function fetchQueuedParticipants(eventId: string): Promise<ParticipantRow[]> {
  const participants = getMatchingServiceSupabaseClient().from("participants");
  const { data, error } = await participants
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "queueing")
    .is("current_match_id", null)
    .gt("chip_balance", 0)
    .order("queued_at", {
      ascending: true,
      nullsFirst: false,
    })
    .limit(1000);

  if (error) {
    throw new AppError("queue_lookup_failed", "Failed to load queueing participants.", 500);
  }

  return data ?? [];
}

async function fetchAvailableTables(eventId: string): Promise<TableRow[]> {
  const tables = getMatchingServiceSupabaseClient().from("tables");
  const { data, error } = await tables
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "available")
    .is("current_match_id", null)
    .order("table_number", {
      ascending: true,
    })
    .limit(5);

  if (error) {
    throw new AppError("table_lookup_failed", "Failed to load available tables.", 500);
  }

  return data ?? [];
}

async function fetchMatchById(matchId: string): Promise<MatchRow> {
  const matches = getMatchingServiceSupabaseClient().from("matches");
  const { data, error } = await matches.select("*").eq("id", matchId).maybeSingle();

  if (error) {
    throw new AppError("match_lookup_failed", "Failed to load created match.", 500);
  }

  if (!data) {
    throw new AppError("match_not_found", "Created match was not found.", 500);
  }

  return data;
}

function assertCanStartQueue(participant: ParticipantRow): void {
  if (participant.status !== "registered") {
    throw new DomainConflictError(
      "participant_status_conflict",
      "Participant must be registered before starting matching.",
    );
  }

  if (participant.current_match_id !== null) {
    throw new DomainConflictError(
      "participant_match_conflict",
      "Participant already has an active match.",
    );
  }

  if (participant.chip_balance <= 0) {
    throw new DomainConflictError(
      "participant_chip_balance_conflict",
      "Participant chip balance must be positive to start matching.",
    );
  }
}

type MatchAttemptPlan = {
  opponentId: string | null;
  tableId: string | null;
  shouldOfferStaff: boolean;
};

async function buildMatchAttemptPlan(params: {
  participant: ParticipantRow;
  event: EventRow;
  queuedParticipants?: ParticipantRow[];
}): Promise<MatchAttemptPlan> {
  const queuedParticipants =
    params.queuedParticipants ?? (await fetchQueuedParticipants(params.event.id));
  const availableTables = await fetchAvailableTables(params.event.id);
  const requesterQueuedAt = params.participant.queued_at;
  const shouldOfferStaff =
    requesterQueuedAt === null
      ? false
      : shouldOfferStaffMatch({
          queuedAt: requesterQueuedAt,
          now: new Date(),
          staffMatchWaitSeconds: params.event.staff_match_wait_seconds,
        });
  const opponent = chooseOpponent({
    requesterId: params.participant.id,
    queuedParticipants: [params.participant, ...queuedParticipants],
  });

  if (!opponent) {
    return {
      opponentId: null,
      tableId: null,
      shouldOfferStaff,
    };
  }

  const table = availableTables[0] ?? null;

  if (!table) {
    return {
      opponentId: null,
      tableId: null,
      shouldOfferStaff,
    };
  }

  return {
    opponentId: opponent.id,
    tableId: table.id,
    shouldOfferStaff,
  };
}

async function invokeStartQueueRpc(args: StartQueueRpcArgs): Promise<StartQueueRpcRow> {
  const { data, error } = await getMatchingServiceSupabaseClient().rpc(
    "start_queue_and_try_match",
    args,
  );

  if (error) {
    normalizeStartQueueError(error.message);
  }

  if (!data || data.length === 0) {
    throw new AppError("matching_start_failed", "Failed to start matching.", 500);
  }

  return data[0];
}

export function chooseOpponent(params: {
  requesterId: string;
  queuedParticipants: ParticipantRow[];
}): ParticipantRow | null {
  const requester =
    params.queuedParticipants.find((participant) => participant.id === params.requesterId) ?? null;
  const eligibleOpponents = params.queuedParticipants.filter(
    (participant) =>
      participant.id !== params.requesterId &&
      participant.status === "queueing" &&
      participant.current_match_id === null &&
      participant.chip_balance > 0,
  );

  if (eligibleOpponents.length === 0) {
    return null;
  }

  const lastOpponentId = requester?.last_opponent_participant_id ?? null;
  const preferredOpponents =
    lastOpponentId === null
      ? eligibleOpponents
      : eligibleOpponents.filter((participant) => participant.id !== lastOpponentId);
  const candidatePool = preferredOpponents.length > 0 ? preferredOpponents : eligibleOpponents;
  const randomIndex = Math.floor(Math.random() * candidatePool.length);

  return candidatePool[randomIndex] ?? null;
}

export function shouldOfferStaffMatch(params: {
  queuedAt: string;
  now: Date;
  staffMatchWaitSeconds: number;
}): boolean {
  const queuedAt = new Date(params.queuedAt);

  if (Number.isNaN(queuedAt.getTime())) {
    throw new RangeError(`Invalid queuedAt timestamp: ${params.queuedAt}`);
  }

  return queuedAt.getTime() + params.staffMatchWaitSeconds * 1000 <= params.now.getTime();
}

export async function executeStartQueue(params: {
  participantId: string;
}): Promise<ParticipantRuntimeState> {
  const participant = await fetchParticipantById(params.participantId);
  assertCanStartQueue(participant);

  const event = await fetchActiveEventById(participant.event_id);
  const plan = await buildMatchAttemptPlan({
    participant,
    event,
  });

  await invokeStartQueueRpc({
    p_participant_id: params.participantId,
    p_opponent_participant_id: plan.opponentId,
    p_table_id: plan.tableId,
  });

  return getParticipantRuntimeState(params.participantId);
}

export async function executeCancelQueue(params: {
  participantId: string;
}): Promise<ParticipantRuntimeState> {
  const { data, error } = await getMatchingServiceSupabaseClient().rpc("cancel_queue", {
    p_participant_id: params.participantId,
  });

  if (error) {
    normalizeCancelQueueError(error.message);
  }

  if (!data || data.length === 0) {
    throw new AppError("matching_cancel_failed", "Failed to cancel matching.", 500);
  }

  return getParticipantRuntimeState(params.participantId);
}

export async function tryCreateNextMatch(eventId: string): Promise<MatchRow | null> {
  const event = await fetchActiveEventById(eventId);
  const queuedParticipants = await fetchQueuedParticipants(eventId);
  const requester = queuedParticipants[0] ?? null;

  if (!requester) {
    return null;
  }

  const plan = await buildMatchAttemptPlan({
    participant: requester,
    event,
    queuedParticipants,
  });

  if (!plan.opponentId || !plan.tableId) {
    return null;
  }

  try {
    const result = await invokeStartQueueRpc({
      p_participant_id: requester.id,
      p_opponent_participant_id: plan.opponentId,
      p_table_id: plan.tableId,
    });

    if (!result.match_id) {
      return null;
    }

    return fetchMatchById(result.match_id);
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === "participant_not_found" || error.code === "active_event_not_found")
    ) {
      return null;
    }

    if (
      error instanceof DomainConflictError &&
      (error.code === "participant_status_conflict" ||
        error.code === "participant_match_conflict" ||
        error.code === "participant_chip_balance_conflict")
    ) {
      return null;
    }

    throw error;
  }
}
