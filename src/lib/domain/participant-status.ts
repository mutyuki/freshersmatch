export const PARTICIPANT_STATUSES = [
  "unregistered",
  "registered",
  "queueing",
  "match_reserved",
  "ready",
  "playing",
  "claiming_win",
  "awaiting_result_approval",
  "result_confirmed",
  "paused",
  "disqualified",
  "disconnected",
] as const;

export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export function isParticipantStatus(value: string): value is ParticipantStatus {
  return PARTICIPANT_STATUSES.includes(value as ParticipantStatus);
}
