import { getSupabaseAdminClient } from "@/lib/db/server";
import {
  getChannelName,
  getRealtimeEventType,
  type RealtimeInvalidationPayload,
  type RealtimeScope,
} from "@/lib/realtime/channels";

export async function publishInvalidation(params: {
  eventId: string;
  scopes: RealtimeScope[];
  participantIds?: string[];
  matchId?: string | null;
  tableId?: string | null;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();

  for (const scope of params.scopes) {
    const channel = supabase.channel(getChannelName(params.eventId, scope));
    const payload: RealtimeInvalidationPayload = {
      eventType: getRealtimeEventType(scope),
      eventId: params.eventId,
      participantIds: params.participantIds,
      matchId: params.matchId ?? null,
      tableId: params.tableId ?? null,
      occurredAt: new Date().toISOString(),
    };

    try {
      const result = await channel.send({
        type: "broadcast",
        event: payload.eventType,
        payload,
      });

      if (result !== "ok") {
        console.error("Failed to publish realtime invalidation.", {
          eventId: params.eventId,
          scope,
          result,
        });
      }
    } catch (error) {
      console.error("Unexpected realtime invalidation publish error.", {
        eventId: params.eventId,
        scope,
        error,
      });
    } finally {
      await supabase.removeChannel(channel);
    }
  }
}
