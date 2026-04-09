import { DomainConflictError } from "@/lib/domain/errors";
import type { MatchStatus } from "@/lib/domain/match-status";
import type { ParticipantStatus } from "@/lib/domain/participant-status";
import type { TableStatus } from "@/lib/domain/table-status";

const participantTransitions: Record<ParticipantStatus, readonly ParticipantStatus[]> = {
  unregistered: ["registered"],
  registered: ["queueing", "paused", "disqualified", "disconnected"],
  queueing: ["match_reserved", "registered", "paused", "disqualified", "disconnected"],
  match_reserved: ["ready", "playing", "registered", "paused", "disqualified", "disconnected"],
  ready: ["playing", "registered", "paused", "disqualified", "disconnected"],
  playing: [
    "claiming_win",
    "awaiting_result_approval",
    "result_confirmed",
    "paused",
    "disqualified",
    "disconnected",
  ],
  claiming_win: ["playing", "result_confirmed", "paused", "disqualified"],
  awaiting_result_approval: ["playing", "result_confirmed", "paused", "disqualified"],
  result_confirmed: ["registered", "paused", "disqualified"],
  paused: ["registered", "disqualified"],
  disqualified: [],
  disconnected: ["registered", "queueing", "match_reserved", "ready", "playing"],
};

const tableTransitions: Record<TableStatus, readonly TableStatus[]> = {
  available: ["reserved", "admin_hold"],
  reserved: ["in_use", "available"],
  in_use: ["available"],
  admin_hold: ["available"],
};

const matchTransitions: Record<MatchStatus, readonly MatchStatus[]> = {
  reserved: ["awaiting_ready", "in_progress", "cancelled_before_start", "voided_by_admin"],
  awaiting_ready: ["in_progress", "cancelled_before_start", "voided_by_admin"],
  in_progress: ["winner_claimed", "voided_by_admin", "force_finished_by_admin"],
  winner_claimed: ["in_progress", "completed", "voided_by_admin", "force_finished_by_admin"],
  completed: [],
  cancelled_before_start: [],
  voided_by_admin: [],
  force_finished_by_admin: [],
};

function assertTransition<TStatus extends string>(
  entity: string,
  transitions: Record<TStatus, readonly TStatus[]>,
  current: TStatus,
  next: TStatus,
): void {
  if (transitions[current].includes(next)) {
    return;
  }

  throw new DomainConflictError(
    "INVALID_STATE_TRANSITION",
    `Invalid ${entity} state transition: ${current} -> ${next}`,
  );
}

export function assertParticipantTransition(
  current: ParticipantStatus,
  next: ParticipantStatus,
): void {
  assertTransition("participant", participantTransitions, current, next);
}

export function assertTableTransition(current: TableStatus, next: TableStatus): void {
  assertTransition("table", tableTransitions, current, next);
}

export function assertMatchTransition(current: MatchStatus, next: MatchStatus): void {
  assertTransition("match", matchTransitions, current, next);
}
