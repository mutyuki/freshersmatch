import type { MatchStatus } from "@/lib/domain/match-status";
import type { ParticipantStatus } from "@/lib/domain/participant-status";
import type { TableStatus } from "@/lib/domain/table-status";

export interface ParticipantRuntimeTable {
  id: string;
  tableNumber: number;
  gameTitle: string;
  ruleId: string | null;
  status: TableStatus;
}

export interface ParticipantRuntimeMatch {
  id: string;
  status: MatchStatus;
  isStaffMatch: boolean;
  agreedBetAmount: number | null;
  disputeCount: number;
}

export interface ParticipantRuntimeOpponent {
  participantId: string;
  nickname: string;
}

export type ParticipantTurnRole = "first" | "second";

export interface ParticipantRuntimeState {
  participantId: string;
  eventId: string;
  nickname: string;
  status: ParticipantStatus;
  lastNonDisconnectStatus: ParticipantStatus | null;
  chipBalance: number;
  currentMatchId: string | null;
  queuedAt: string | null;
  table: ParticipantRuntimeTable | null;
  match: ParticipantRuntimeMatch | null;
  opponent: ParticipantRuntimeOpponent | null;
  turnRole: ParticipantTurnRole | null;
  opponentReady: boolean;
  winnerParticipantId: string | null;
  winnerClaimedByParticipantId: string | null;
  disqualifiedReason: string | null;
  resultDelta: number | null;
  resultConfirmedAt: string | null;
  canStartMatching: boolean;
  canClaimWin: boolean;
}
