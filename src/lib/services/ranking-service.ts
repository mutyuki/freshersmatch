import type { RankingEntry } from "@/lib/contracts/ranking";
import { getSupabaseAdminClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { AppError } from "@/lib/domain/errors";

type ParticipantRankingRow = Pick<
  Database["public"]["Tables"]["participants"]["Row"],
  "id" | "nickname" | "chip_balance" | "status" | "created_at"
>;

function toRankingEntries(rows: ParticipantRankingRow[]): RankingEntry[] {
  let previousChipBalance: number | null = null;
  let currentRank = 0;

  return rows.map((row, index) => {
    if (row.chip_balance !== previousChipBalance) {
      currentRank = index + 1;
      previousChipBalance = row.chip_balance;
    }

    return {
      participantId: row.id,
      nickname: row.nickname,
      chipBalance: row.chip_balance,
      status: row.status,
      rank: currentRank,
    };
  });
}

export async function listRanking(params: { eventId: string }): Promise<RankingEntry[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("participants")
    .select("id,nickname,chip_balance,status,created_at")
    .eq("event_id", params.eventId)
    .order("chip_balance", { ascending: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new AppError("ranking_lookup_failed", "Failed to load ranking.", 500);
  }

  return toRankingEntries((data ?? []) as ParticipantRankingRow[]);
}
