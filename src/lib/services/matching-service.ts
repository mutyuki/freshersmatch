import { getParticipantRuntimeState } from "@/lib/services/participant-service";
import { getSupabaseAdminClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { AppError, DomainConflictError } from "@/lib/domain/errors";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";

type StartQueueRpcRow =
  Database["public"]["Functions"]["start_queue_and_try_match"]["Returns"][number];

type StartQueueRpcResult = Promise<{
  data: StartQueueRpcRow[] | null;
  error: { message: string } | null;
}>;

type MatchingServiceSupabaseClient = {
  rpc(
    fn: "start_queue_and_try_match",
    args: Database["public"]["Functions"]["start_queue_and_try_match"]["Args"],
  ): StartQueueRpcResult;
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

  if (message.includes("Participant is not in registered status")) {
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

export async function executeStartQueue(params: {
  participantId: string;
}): Promise<ParticipantRuntimeState> {
  const { data, error } = await getMatchingServiceSupabaseClient().rpc(
    "start_queue_and_try_match",
    {
      p_participant_id: params.participantId,
    },
  );

  if (error) {
    normalizeStartQueueError(error.message);
  }

  if (!data || data.length === 0) {
    throw new AppError("matching_start_failed", "Failed to start matching.", 500);
  }

  return getParticipantRuntimeState(params.participantId);
}
