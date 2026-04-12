import { getSupabaseAdminClient } from "@/lib/db/server";
import { AppError } from "@/lib/domain/errors";

type InvalidationScope = "participant" | "match" | "ranking" | "admin";

type InvalidationPayload = {
  eventId: string;
  scopes: InvalidationScope[];
  participantIds?: string[];
  matchId?: string | null;
  tableId?: string | null;
  publishedAt: string;
};

function getChannelName(eventId: string, scope: InvalidationScope): string {
  return `event:${eventId}:${scope}`;
}

export async function publishInvalidation(params: {
  eventId: string;
  scopes: InvalidationScope[];
  participantIds?: string[];
  matchId?: string | null;
  tableId?: string | null;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const payload: InvalidationPayload = {
    eventId: params.eventId,
    scopes: params.scopes,
    participantIds: params.participantIds,
    matchId: params.matchId ?? null,
    tableId: params.tableId ?? null,
    publishedAt: new Date().toISOString(),
  };

  for (const scope of params.scopes) {
    const channel = supabase.channel(getChannelName(params.eventId, scope));
    const result = await channel.send({
      type: "broadcast",
      event: "invalidation",
      payload,
    });

    await supabase.removeChannel(channel);

    if (result !== "ok") {
      throw new AppError(
        "invalidation_publish_failed",
        "Failed to publish realtime invalidation.",
        500,
      );
    }
  }
}
