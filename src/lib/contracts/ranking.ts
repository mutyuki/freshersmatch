import type { ParticipantStatus } from "@/lib/domain/participant-status";

export interface RankingEntry {
  participantId: string;
  nickname: string;
  chipBalance: number;
  status: ParticipantStatus;
  rank: number;
}

export interface RankingSnapshot {
  eventId: string;
  entries: RankingEntry[];
}
