import type { MatchStatus } from "@/lib/domain/match-status";
import type { ParticipantStatus } from "@/lib/domain/participant-status";
import type { TableStatus } from "@/lib/domain/table-status";

export interface AdminDashboardTable {
  tableId: string;
  tableNumber: number;
  gameTitle: string;
  status: TableStatus;
  currentMatchId: string | null;
  occupantNicknames: string[];
  heldByAdminDisplayName: string | null;
}

export interface AdminDashboardQueueingParticipant {
  participantId: string;
  nickname: string;
  queuedAt: string;
  chipBalance: number;
  isStaffMatchCandidate: boolean;
}

export interface AdminDashboardInProgressMatch {
  matchId: string;
  tableNumber: number | null;
  tableId: string | null;
  displayStatus: MatchStatus;
  participant1Id: string;
  participant1Nickname: string;
  participant2Nickname: string | null;
  isStaffMatch: boolean;
  startedAt: string | null;
}

export interface AdminDashboardDisconnectedParticipant {
  participantId: string;
  nickname: string;
  lastNonDisconnectStatus: ParticipantStatus | null;
  lastSeenAt: string;
}

export interface AdminDashboardDisputedMatch {
  matchId: string;
  tableNumber: number | null;
  disputeCount: number;
  lastDisputedAt: string | null;
}

export interface AdminDashboardStalledMatch {
  matchId: string;
  tableNumber: number | null;
  status: MatchStatus;
  winnerClaimedAt: string | null;
  startedAt: string | null;
  participant1Nickname: string;
  participant2Nickname: string | null;
}

export interface AdminDashboardData {
  eventId: string;
  tables: AdminDashboardTable[];
  queueingParticipants: AdminDashboardQueueingParticipant[];
  inProgressMatches: AdminDashboardInProgressMatch[];
  disconnectedParticipants: AdminDashboardDisconnectedParticipant[];
  disputedMatches: AdminDashboardDisputedMatch[];
  stalledMatches: AdminDashboardStalledMatch[];
}
