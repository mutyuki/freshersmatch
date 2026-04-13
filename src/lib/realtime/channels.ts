export type RealtimeScope = "participant" | "match" | "ranking" | "admin";

export const PARTICIPANT_REALTIME_EVENT = "participant.runtime.invalidated";
export const MATCH_REALTIME_EVENT = "match.invalidated";
export const RANKING_REALTIME_EVENT = "ranking.invalidated";
export const ADMIN_REALTIME_EVENT = "admin.dashboard.invalidated";

export type RealtimeEventType =
  | typeof PARTICIPANT_REALTIME_EVENT
  | typeof MATCH_REALTIME_EVENT
  | typeof RANKING_REALTIME_EVENT
  | typeof ADMIN_REALTIME_EVENT;

export interface RealtimeInvalidationPayload {
  eventType: RealtimeEventType;
  eventId: string;
  participantIds?: string[];
  matchId?: string | null;
  tableId?: string | null;
  occurredAt: string;
}

export function getInvalidationChannelName(eventId: string): string {
  return `event:${eventId}:invalidation`;
}

export function getChannelName(eventId: string, scope: RealtimeScope): string {
  void scope;
  return getInvalidationChannelName(eventId);
}

export function getParticipantChannelName(eventId: string): string {
  return getChannelName(eventId, "participant");
}

export function getMatchChannelName(eventId: string): string {
  return getChannelName(eventId, "match");
}

export function getRankingChannelName(eventId: string): string {
  return getChannelName(eventId, "ranking");
}

export function getAdminChannelName(eventId: string): string {
  return getChannelName(eventId, "admin");
}

export function getRealtimeEventType(scope: RealtimeScope): RealtimeEventType {
  switch (scope) {
    case "participant":
      return PARTICIPANT_REALTIME_EVENT;
    case "match":
      return MATCH_REALTIME_EVENT;
    case "ranking":
      return RANKING_REALTIME_EVENT;
    case "admin":
      return ADMIN_REALTIME_EVENT;
  }
}
