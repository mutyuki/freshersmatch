import type { ParticipantStatus } from "@/lib/domain/participant-status";

export interface AdminParticipantListItem {
  participantId: string;
  nickname: string;
  status: ParticipantStatus;
  chipBalance: number;
  currentMatchId: string | null;
  lastSeenAt: string;
  disqualifiedReason: string | null;
}
