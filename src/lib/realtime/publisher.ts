import type { RealtimeChannel } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/db/server";
import {
  getChannelName,
  getRealtimeEventType,
  type RealtimeInvalidationPayload,
  type RealtimeScope,
} from "@/lib/realtime/channels";

type RealtimeSubscribeStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

async function subscribeChannel(channel: RealtimeChannel): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status: RealtimeSubscribeStatus, error?: Error) => {
      if (status === "SUBSCRIBED") {
        resolve();
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        reject(error ?? new Error(`Realtime channel subscribe failed: ${status}`));
      }
    });
  });
}

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
      await subscribeChannel(channel);

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
