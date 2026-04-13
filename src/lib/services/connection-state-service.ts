import { getSupabaseAdminClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { isDisconnected } from "@/lib/domain/disconnect-rules";
import { AppError } from "@/lib/domain/errors";
import type { ParticipantStatus } from "@/lib/domain/participant-status";
import { assertParticipantTransition } from "@/lib/domain/state-machine";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];

type QueryResult<TData> = Promise<{
  data: TData;
  error: { message: string } | null;
}>;

type ParticipantSelectQuery = {
  select(columns: string): {
    eq(
      column: "id" | "event_id",
      value: string,
    ): {
      maybeSingle(): QueryResult<ParticipantRow | null>;
      select?(columns: string): QueryResult<ParticipantRow[] | null>;
    };
    maybeSingle(): QueryResult<ParticipantRow | null>;
  };
  update(
    values: Pick<
      Database["public"]["Tables"]["participants"]["Update"],
      "status" | "last_non_disconnect_status"
    >,
  ): {
    eq(
      column: "id",
      value: string,
    ): {
      select(columns: "id"): QueryResult<Array<Pick<ParticipantRow, "id">> | null>;
    };
  };
};

type EventSelectQuery = {
  select(columns: string): {
    eq(
      column: "id" | "status",
      value: string,
    ): {
      eq(
        column: "status",
        value: string,
      ): {
        maybeSingle(): QueryResult<EventRow | null>;
      };
      maybeSingle(): QueryResult<EventRow | null>;
    };
    maybeSingle(): QueryResult<EventRow | null>;
  };
};

type ConnectionStateSupabaseClient = {
  from(table: "participants"): ParticipantSelectQuery;
  from(table: "events"): EventSelectQuery;
};

const DISCONNECT_ELIGIBLE_STATUSES = new Set<ParticipantStatus>([
  "registered",
  "queueing",
  "match_reserved",
  "ready",
  "playing",
]);

function getConnectionStateSupabaseClient(): ConnectionStateSupabaseClient {
  return getSupabaseAdminClient() as unknown as ConnectionStateSupabaseClient;
}

async function fetchParticipantById(participantId: string): Promise<ParticipantRow> {
  const participants = getConnectionStateSupabaseClient().from("participants");
  const { data, error } = await participants.select("*").eq("id", participantId).maybeSingle();

  if (error) {
    throw new AppError("participant_lookup_failed", "Failed to load participant.", 500);
  }

  if (!data) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  return data;
}

async function fetchActiveEventById(eventId: string): Promise<EventRow> {
  const events = getConnectionStateSupabaseClient().from("events");
  const { data, error } = await events
    .select("*")
    .eq("id", eventId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new AppError("active_event_lookup_failed", "Failed to load active event.", 500);
  }

  if (!data) {
    throw new AppError("active_event_not_found", "Active event was not found.", 404);
  }

  return data;
}

async function persistParticipantState(params: {
  participantId: string;
  status: ParticipantStatus;
  lastNonDisconnectStatus: ParticipantStatus | null;
}): Promise<void> {
  const participants = getConnectionStateSupabaseClient().from("participants");
  const { data, error } = await participants
    .update({
      status: params.status,
      last_non_disconnect_status: params.lastNonDisconnectStatus,
    })
    .eq("id", params.participantId)
    .select("id");

  if (error) {
    throw new AppError(
      "participant_connection_state_persist_failed",
      "Failed to persist participant connection state.",
      500,
    );
  }

  if (!data || data.length === 0) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }
}

export async function normalizeParticipantConnectionState(params: {
  participantId: string;
  now: Date;
}): Promise<void> {
  const participant = await fetchParticipantById(params.participantId);

  if (!DISCONNECT_ELIGIBLE_STATUSES.has(participant.status)) {
    return;
  }

  const event = await fetchActiveEventById(participant.event_id);
  const shouldDisconnect = isDisconnected({
    lastSeenAt: participant.last_seen_at,
    now: params.now,
    disconnectThresholdSeconds: event.disconnect_threshold_seconds,
  });

  if (!shouldDisconnect) {
    return;
  }

  assertParticipantTransition(participant.status, "disconnected");

  await persistParticipantState({
    participantId: participant.id,
    status: "disconnected",
    lastNonDisconnectStatus: participant.status,
  });
}

export async function restoreDisconnectedParticipantIfNeeded(params: {
  participantId: string;
}): Promise<boolean> {
  const participant = await fetchParticipantById(params.participantId);

  if (participant.status !== "disconnected") {
    return false;
  }

  const nextStatus = participant.last_non_disconnect_status ?? "registered";
  assertParticipantTransition("disconnected", nextStatus);

  await persistParticipantState({
    participantId: participant.id,
    status: nextStatus,
    lastNonDisconnectStatus: participant.last_non_disconnect_status,
  });

  return true;
}
