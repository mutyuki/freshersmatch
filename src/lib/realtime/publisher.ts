import type { RealtimeChannel } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/db/server";
import {
  getInvalidationChannelName,
  getRealtimeEventType,
  type RealtimeInvalidationPayload,
  type RealtimeScope,
} from "@/lib/realtime/channels";

type RealtimeSubscribeStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";
const SUBSCRIBE_TIMEOUT_MS = 1_000;

async function subscribeChannel(channel: RealtimeChannel): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      reject(
        new Error(`Realtime channel subscribe failed: timed out after ${SUBSCRIBE_TIMEOUT_MS}ms`),
      );
    }, SUBSCRIBE_TIMEOUT_MS);

    channel.subscribe((status: RealtimeSubscribeStatus, error?: Error) => {
      if (settled) {
        return;
      }

      if (status === "SUBSCRIBED") {
        settled = true;
        clearTimeout(timeoutId);
        resolve();
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        settled = true;
        clearTimeout(timeoutId);
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
  const channel = supabase.channel(getInvalidationChannelName(params.eventId));

  try {
    await subscribeChannel(channel);

    for (const scope of params.scopes) {
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
        console.error("Unexpected realtime invalidation send error.", {
          eventId: params.eventId,
          scope,
          error,
        });
      }
    }
  } catch (error) {
    console.error("Unexpected realtime invalidation subscribe error.", {
      eventId: params.eventId,
      scopes: params.scopes,
      error,
    });
  } finally {
    try {
      await supabase.removeChannel(channel);
    } catch (error) {
      console.error("Failed to remove realtime invalidation channel.", {
        eventId: params.eventId,
        error,
      });
    }
  }
}
