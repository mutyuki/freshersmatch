import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";
import { getSupabaseAdminClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { AppError, DomainConflictError } from "@/lib/domain/errors";
import { getParticipantRuntimeState } from "@/lib/services/participant-service";

type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];

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

type ReadyMatchRpcArgs = Database["public"]["Functions"]["ready_match"]["Args"];
type ReadyMatchRpcRow = Database["public"]["Functions"]["ready_match"]["Returns"][number];
type CancelMatchBeforeStartRpcArgs =
  Database["public"]["Functions"]["cancel_match_before_start"]["Args"];
type CancelMatchBeforeStartRpcRow =
  Database["public"]["Functions"]["cancel_match_before_start"]["Returns"][number];
type ClaimMatchWinRpcArgs = Database["public"]["Functions"]["claim_match_win"]["Args"];
type ClaimMatchWinRpcRow = Database["public"]["Functions"]["claim_match_win"]["Returns"][number];
type ApproveMatchResultRpcArgs = Database["public"]["Functions"]["approve_match_result"]["Args"];
type ApproveMatchResultRpcRow =
  Database["public"]["Functions"]["approve_match_result"]["Returns"][number];
type AcknowledgeResultConfirmedRpcArgs =
  Database["public"]["Functions"]["acknowledge_result_confirmed"]["Args"];
type AcknowledgeResultConfirmedRpcRow =
  Database["public"]["Functions"]["acknowledge_result_confirmed"]["Returns"][number];

type MatchServiceSupabaseClient = {
  from(table: "participants"): TableQuery<ParticipantRow>;
  from(table: "matches"): TableQuery<MatchRow>;
  rpc(fn: "ready_match", args: ReadyMatchRpcArgs): RpcResult<ReadyMatchRpcRow>;
  rpc(
    fn: "cancel_match_before_start",
    args: CancelMatchBeforeStartRpcArgs,
  ): RpcResult<CancelMatchBeforeStartRpcRow>;
  rpc(fn: "claim_match_win", args: ClaimMatchWinRpcArgs): RpcResult<ClaimMatchWinRpcRow>;
  rpc(
    fn: "approve_match_result",
    args: ApproveMatchResultRpcArgs,
  ): RpcResult<ApproveMatchResultRpcRow>;
  rpc(
    fn: "acknowledge_result_confirmed",
    args: AcknowledgeResultConfirmedRpcArgs,
  ): RpcResult<AcknowledgeResultConfirmedRpcRow>;
};

function getMatchServiceSupabaseClient(): MatchServiceSupabaseClient {
  return getSupabaseAdminClient() as unknown as MatchServiceSupabaseClient;
}

async function fetchParticipantById(participantId: string): Promise<ParticipantRow> {
  const participants = getMatchServiceSupabaseClient().from("participants");
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
  const matches = getMatchServiceSupabaseClient().from("matches");
  const { data, error } = await matches.select("*").eq("id", matchId).maybeSingle();

  if (error) {
    throw new AppError("match_lookup_failed", "Failed to load match.", 500);
  }

  if (!data) {
    throw new AppError("match_not_found", "Match was not found.", 404);
  }

  return data;
}

function assertParticipantBelongsToMatch(params: { participantId: string; match: MatchRow }): void {
  const { participantId, match } = params;

  if (
    match.player1_participant_id === participantId ||
    match.player2_participant_id === participantId
  ) {
    return;
  }

  throw new DomainConflictError(
    "participant_match_conflict",
    "Participant is not part of the requested match.",
  );
}

function normalizeReadyMatchError(message: string): never {
  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (message.includes("Match not found")) {
    throw new AppError("match_not_found", "Match was not found.", 404);
  }

  if (message.includes("Participant is not part of the match")) {
    throw new DomainConflictError(
      "participant_match_conflict",
      "Participant is not part of the requested match.",
    );
  }

  if (
    message.includes("ready") ||
    message.includes("reserved") ||
    message.includes("awaiting_ready") ||
    message.includes("in_progress") ||
    message.includes("chip balance") ||
    message.includes("already has an active match")
  ) {
    throw new DomainConflictError(
      "match_ready_conflict",
      "Participant cannot ready this match from the current state.",
    );
  }

  throw new AppError("match_ready_failed", "Failed to update match ready state.", 500);
}

function normalizeCancelBeforeStartError(message: string): never {
  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (message.includes("Match not found")) {
    throw new AppError("match_not_found", "Match was not found.", 404);
  }

  if (
    message.includes("not part of the match") ||
    message.includes("reserved") ||
    message.includes("awaiting_ready") ||
    message.includes("already started")
  ) {
    throw new DomainConflictError(
      "match_cancel_conflict",
      "Match cannot be cancelled before start from the current state.",
    );
  }

  throw new AppError(
    "match_cancel_before_start_failed",
    "Failed to cancel the match before start.",
    500,
  );
}

function normalizeClaimWinError(message: string): never {
  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (message.includes("Match not found")) {
    throw new AppError("match_not_found", "Match was not found.", 404);
  }

  if (
    message.includes("not part of the match") ||
    message.includes("winner_claimed") ||
    message.includes("in_progress") ||
    message.includes("staff match")
  ) {
    throw new DomainConflictError(
      "match_claim_conflict",
      "Participant cannot claim a win for this match from the current state.",
    );
  }

  throw new AppError("match_claim_failed", "Failed to claim the match result.", 500);
}

function normalizeApproveResultError(message: string): never {
  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (message.includes("Match not found")) {
    throw new AppError("match_not_found", "Match was not found.", 404);
  }

  if (
    message.includes("not part of the match") ||
    message.includes("winner_claimed") ||
    message.includes("already resolved") ||
    message.includes("claiming participant cannot approve")
  ) {
    throw new DomainConflictError(
      "match_approval_conflict",
      "Match result cannot be approved from the current state.",
    );
  }

  throw new AppError("match_approval_failed", "Failed to approve the match result.", 500);
}

function normalizeAcknowledgeResultError(message: string): never {
  if (message.includes("Participant not found")) {
    throw new AppError("participant_not_found", "Participant was not found.", 404);
  }

  if (message.includes("result_confirmed") || message.includes("registered")) {
    throw new DomainConflictError(
      "participant_status_conflict",
      "Participant cannot acknowledge the result from the current state.",
    );
  }

  throw new AppError(
    "participant_result_acknowledge_failed",
    "Failed to acknowledge the confirmed result.",
    500,
  );
}

async function assertParticipantAndMatch(params: {
  participantId: string;
  matchId: string;
}): Promise<{ participant: ParticipantRow; match: MatchRow }> {
  const participant = await fetchParticipantById(params.participantId);
  const match = await fetchMatchById(params.matchId);

  assertParticipantBelongsToMatch({
    participantId: participant.id,
    match,
  });

  return {
    participant,
    match,
  };
}

export async function executeReadyMatch(params: {
  participantId: string;
  matchId: string;
}): Promise<ParticipantRuntimeState> {
  const { participant } = await assertParticipantAndMatch(params);
  const supabase = getMatchServiceSupabaseClient();
  const { data, error } = await supabase.rpc("ready_match", {
    p_participant_id: participant.id,
    p_match_id: params.matchId,
  });

  if (error) {
    normalizeReadyMatchError(error.message);
  }

  if (!data?.[0]) {
    throw new AppError("match_ready_failed", "Match ready RPC returned no result.", 500);
  }

  return getParticipantRuntimeState(participant.id);
}

export async function executeCancelBeforeStart(params: {
  participantId: string;
  matchId: string;
}): Promise<ParticipantRuntimeState> {
  const { participant } = await assertParticipantAndMatch(params);
  const supabase = getMatchServiceSupabaseClient();
  const { data, error } = await supabase.rpc("cancel_match_before_start", {
    p_participant_id: participant.id,
    p_match_id: params.matchId,
  });

  if (error) {
    normalizeCancelBeforeStartError(error.message);
  }

  if (!data?.[0]) {
    throw new AppError(
      "match_cancel_before_start_failed",
      "Match cancel RPC returned no result.",
      500,
    );
  }

  return getParticipantRuntimeState(participant.id);
}

export async function executeClaimWin(params: {
  participantId: string;
  matchId: string;
}): Promise<ParticipantRuntimeState> {
  const { participant } = await assertParticipantAndMatch(params);
  const supabase = getMatchServiceSupabaseClient();
  const { data, error } = await supabase.rpc("claim_match_win", {
    p_participant_id: participant.id,
    p_match_id: params.matchId,
  });

  if (error) {
    normalizeClaimWinError(error.message);
  }

  if (!data?.[0]) {
    throw new AppError("match_claim_failed", "Match claim RPC returned no result.", 500);
  }

  return getParticipantRuntimeState(participant.id);
}

export async function executeApproveResult(params: {
  participantId: string;
  matchId: string;
  approve: boolean;
}): Promise<ParticipantRuntimeState> {
  const { participant } = await assertParticipantAndMatch(params);
  const supabase = getMatchServiceSupabaseClient();
  const { data, error } = await supabase.rpc("approve_match_result", {
    p_participant_id: participant.id,
    p_match_id: params.matchId,
    p_approve: params.approve,
  });

  if (error) {
    normalizeApproveResultError(error.message);
  }

  if (!data?.[0]) {
    throw new AppError("match_approval_failed", "Match approval RPC returned no result.", 500);
  }

  return getParticipantRuntimeState(participant.id);
}

export async function acknowledgeResultConfirmed(params: {
  participantId: string;
}): Promise<ParticipantRuntimeState> {
  const participant = await fetchParticipantById(params.participantId);
  const supabase = getMatchServiceSupabaseClient();
  const { data, error } = await supabase.rpc("acknowledge_result_confirmed", {
    p_participant_id: participant.id,
  });

  if (error) {
    normalizeAcknowledgeResultError(error.message);
  }

  if (!data?.[0]) {
    throw new AppError(
      "participant_result_acknowledge_failed",
      "Result acknowledge RPC returned no result.",
      500,
    );
  }

  return getParticipantRuntimeState(participant.id);
}

export async function completeMatchAndApplyChipLedger(params: {
  matchId: string;
  winnerParticipantId: string;
}): Promise<void> {
  const match = await fetchMatchById(params.matchId);

  if (match.is_staff_match) {
    throw new DomainConflictError(
      "staff_match_completion_conflict",
      "Staff matches must be completed through the staff resolution flow.",
    );
  }

  if (match.winner_claimed_by_participant_id !== params.winnerParticipantId) {
    throw new DomainConflictError(
      "winner_claim_conflict",
      "Winner claim does not match the requested winner.",
    );
  }

  const approverParticipantId =
    match.player1_participant_id === params.winnerParticipantId
      ? match.player2_participant_id
      : match.player1_participant_id;

  if (!approverParticipantId) {
    throw new AppError(
      "match_completion_invalid",
      "A head-to-head match cannot be completed without an approving opponent.",
      500,
    );
  }

  await executeApproveResult({
    participantId: approverParticipantId,
    matchId: params.matchId,
    approve: true,
  });
}
