export const MATCH_STATUSES = [
  "reserved",
  "awaiting_ready",
  "in_progress",
  "winner_claimed",
  "completed",
  "cancelled_before_start",
  "voided_by_admin",
  "force_finished_by_admin",
] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];

export function isMatchStatus(value: string): value is MatchStatus {
  return MATCH_STATUSES.includes(value as MatchStatus);
}
