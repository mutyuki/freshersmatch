import type { MatchStatus } from "@/lib/domain/match-status";

export interface AdminMatchListItem {
  matchId: string;
  tableNumber: number | null;
  status: MatchStatus;
  participant1Id: string;
  participant1Nickname: string;
  participant2Id: string | null;
  participant2Nickname: string | null;
  startedAt: string | null;
  disputeCount: number;
}
