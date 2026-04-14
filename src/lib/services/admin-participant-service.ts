import type { AdminParticipantListItem } from "@/lib/contracts/admin-participants";
import { getSupabaseAdminClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { AppError, DomainConflictError } from "@/lib/domain/errors";
import { normalizeParticipantConnectionState } from "@/lib/services/connection-state-service";

type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type AdjustParticipantChipRpcArgs =
  Database["public"]["Functions"]["adjust_participant_chip"]["Args"];
type AdjustParticipantChipRpcRow =
  Database["public"]["Functions"]["adjust_participant_chip"]["Returns"][number];
type PauseParticipantRpcArgs = Database["public"]["Functions"]["pause_participant"]["Args"];
type PauseParticipantRpcRow =
  Database["public"]["Functions"]["pause_participant"]["Returns"][number];
type UnpauseParticipantRpcArgs = Database["public"]["Functions"]["unpause_participant"]["Args"];
type UnpauseParticipantRpcRow =
  Database["public"]["Functions"]["unpause_participant"]["Returns"][number];
type DisqualifyParticipantRpcArgs =
  Database["public"]["Functions"]["disqualify_participant"]["Args"];
type DisqualifyParticipantRpcRow =
  Database["public"]["Functions"]["disqualify_participant"]["Returns"][number];
type DeleteParticipantRpcArgs =
  Database["public"]["Functions"]["delete_participant_by_admin"]["Args"];
type DeleteParticipantRpcRow =
  Database["public"]["Functions"]["delete_participant_by_admin"]["Returns"][number];

type QueryResult<TData> = Promise<{
  data: TData;
  error: { message: string } | null;
}>;

type RpcResult<TRow> = Promise<{
  data: TRow[] | null;
  error: { message: string } | null;
}>;

type ParticipantSelectQuery = {
  eq(column: "id" | "event_id", value: string): ParticipantSelectQuery;
  order(
    column: "created_at",
    options?: {
      ascending?: boolean;
    },
  ): ParticipantSelectQuery;
  maybeSingle(): QueryResult<ParticipantRow | null>;
  limit(count: number): QueryResult<ParticipantRow[] | null>;
};

type ParticipantTableQuery = {
  select(columns: string): ParticipantSelectQuery;
};

type AdminParticipantSupabaseClient = {
  from(table: "participants"): ParticipantTableQuery;
  rpc(
    fn: "adjust_participant_chip",
    args: AdjustParticipantChipRpcArgs,
  ): RpcResult<AdjustParticipantChipRpcRow>;
  rpc(fn: "pause_participant", args: PauseParticipantRpcArgs): RpcResult<PauseParticipantRpcRow>;
  rpc(
    fn: "unpause_participant",
    args: UnpauseParticipantRpcArgs,
  ): RpcResult<UnpauseParticipantRpcRow>;
  rpc(
    fn: "disqualify_participant",
    args: DisqualifyParticipantRpcArgs,
  ): RpcResult<DisqualifyParticipantRpcRow>;
  rpc(
    fn: "delete_participant_by_admin",
    args: DeleteParticipantRpcArgs,
  ): RpcResult<DeleteParticipantRpcRow>;
};

export interface AdminParticipantMutationResult {
  eventId: string;
  participantId: string;
  affectedMatchId?: string | null;
}

function getAdminParticipantSupabaseClient(): AdminParticipantSupabaseClient {
  return getSupabaseAdminClient() as unknown as AdminParticipantSupabaseClient;
}

async function fetchParticipantById(participantId: string): Promise<ParticipantRow> {
  const participants = getAdminParticipantSupabaseClient().from("participants");
  const { data, error } = await participants.select("*").eq("id", participantId).maybeSingle();

  if (error) {
    throw new AppError("participant_lookup_failed", "Failed to load participant.", 500);
  }

  if (!data) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  return data;
}

async function fetchParticipants(eventId: string): Promise<ParticipantRow[]> {
  const participants = getAdminParticipantSupabaseClient().from("participants");
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

function normalizeAdjustChipError(message: string): never {
  if (message.includes("Admin user not found")) {
    throw new AppError("admin_user_not_found", "Admin user was not found.", 404);
  }

  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (message.includes("cannot go negative")) {
    throw new DomainConflictError(
      "participant_chip_adjust_conflict",
      "Participant chip balance cannot go negative.",
    );
  }

  throw new AppError("participant_chip_adjust_failed", "Failed to adjust participant chips.", 500);
}

function normalizePauseError(message: string): never {
  if (message.includes("Admin user not found")) {
    throw new AppError("admin_user_not_found", "Admin user was not found.", 404);
  }

  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (
    message.includes("cannot be paused") ||
    message.includes("not part of active match") ||
    message.includes("unsupported")
  ) {
    throw new DomainConflictError(
      "participant_pause_conflict",
      "Participant cannot be paused from the current state.",
    );
  }

  throw new AppError("participant_pause_failed", "Failed to pause participant.", 500);
}

function normalizeUnpauseError(message: string): never {
  if (message.includes("Admin user not found")) {
    throw new AppError("admin_user_not_found", "Admin user was not found.", 404);
  }

  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (message.includes("cannot be unpaused")) {
    throw new DomainConflictError(
      "participant_unpause_conflict",
      "Participant cannot be unpaused from the current state.",
    );
  }

  throw new AppError("participant_unpause_failed", "Failed to unpause participant.", 500);
}

function normalizeDisqualifyError(message: string): never {
  if (message.includes("Admin user not found")) {
    throw new AppError("admin_user_not_found", "Admin user was not found.", 404);
  }

  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (
    message.includes("Unsupported disqualification mode") ||
    message.includes("cannot be disqualified") ||
    message.includes("not part of active match")
  ) {
    throw new DomainConflictError(
      "participant_disqualify_conflict",
      "Participant cannot be disqualified from the current state.",
    );
  }

  throw new AppError("participant_disqualify_failed", "Failed to disqualify participant.", 500);
}

function normalizeDeleteError(message: string): never {
  if (message.includes("Admin user not found")) {
    throw new AppError("admin_user_not_found", "Admin user was not found.", 404);
  }

  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (
    message.includes("cannot be deleted") ||
    message.includes("active match references exist") ||
    message.includes("match history exists")
  ) {
    throw new DomainConflictError(
      "participant_delete_conflict",
      "Participant cannot be deleted from the current state.",
    );
  }

  throw new AppError("participant_delete_failed", "Failed to delete participant.", 500);
}

export async function listAdminParticipants(eventId: string): Promise<AdminParticipantListItem[]> {
  const initialParticipants = await fetchParticipants(eventId);

  for (const participant of initialParticipants) {
    await normalizeParticipantConnectionState({
      participantId: participant.id,
      now: new Date(),
    });
  }

  const participants = await fetchParticipants(eventId);

  return participants.map((participant) => ({
    participantId: participant.id,
    nickname: participant.nickname,
    status: participant.status,
    chipBalance: participant.chip_balance,
    currentMatchId: participant.current_match_id ?? null,
    lastSeenAt: participant.last_seen_at,
    disqualifiedReason: participant.disqualified_reason ?? null,
  }));
}

export async function adjustParticipantChip(params: {
  adminUserId: string;
  participantId: string;
  delta: number;
  reason: string;
}): Promise<AdminParticipantMutationResult> {
  const participant = await fetchParticipantById(params.participantId);
  const { error } = await getAdminParticipantSupabaseClient().rpc("adjust_participant_chip", {
    p_admin_user_id: params.adminUserId,
    p_participant_id: params.participantId,
    p_delta: params.delta,
    p_reason: params.reason,
  });

  if (error) {
    normalizeAdjustChipError(error.message);
  }

  return {
    eventId: participant.event_id,
    participantId: participant.id,
  };
}

export async function pauseParticipant(params: {
  adminUserId: string;
  participantId: string;
}): Promise<AdminParticipantMutationResult> {
  const participant = await fetchParticipantById(params.participantId);
  const { data, error } = await getAdminParticipantSupabaseClient().rpc("pause_participant", {
    p_admin_user_id: params.adminUserId,
    p_participant_id: params.participantId,
  });

  if (error) {
    normalizePauseError(error.message);
  }

  return {
    eventId: participant.event_id,
    participantId: participant.id,
    affectedMatchId: data?.[0]?.affected_match_id ?? null,
  };
}

export async function unpauseParticipant(params: {
  adminUserId: string;
  participantId: string;
}): Promise<AdminParticipantMutationResult> {
  const participant = await fetchParticipantById(params.participantId);
  const { error } = await getAdminParticipantSupabaseClient().rpc("unpause_participant", {
    p_admin_user_id: params.adminUserId,
    p_participant_id: params.participantId,
  });

  if (error) {
    normalizeUnpauseError(error.message);
  }

  return {
    eventId: participant.event_id,
    participantId: participant.id,
  };
}

export async function disqualifyParticipant(params: {
  adminUserId: string;
  participantId: string;
  mode: "void_current_match" | "lose_current_match";
  reason: string;
}): Promise<AdminParticipantMutationResult> {
  const participant = await fetchParticipantById(params.participantId);
  const { data, error } = await getAdminParticipantSupabaseClient().rpc("disqualify_participant", {
    p_admin_user_id: params.adminUserId,
    p_participant_id: params.participantId,
    p_mode: params.mode,
    p_reason: params.reason,
  });

  if (error) {
    normalizeDisqualifyError(error.message);
  }

  return {
    eventId: participant.event_id,
    participantId: participant.id,
    affectedMatchId: data?.[0]?.affected_match_id ?? null,
  };
}

export async function deleteParticipant(params: {
  adminUserId: string;
  participantId: string;
}): Promise<AdminParticipantMutationResult> {
  const participant = await fetchParticipantById(params.participantId);
  const { error } = await getAdminParticipantSupabaseClient().rpc("delete_participant_by_admin", {
    p_admin_user_id: params.adminUserId,
    p_participant_id: params.participantId,
  });

  if (error) {
    normalizeDeleteError(error.message);
  }

  return {
    eventId: participant.event_id,
    participantId: participant.id,
  };
}
