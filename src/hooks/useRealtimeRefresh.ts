"use client";

import { useEffect, useRef } from "react";

import { createRealtimeClient } from "@/lib/realtime/client";
import type { RealtimeInvalidationPayload, RealtimeEventType } from "@/lib/realtime/channels";

const FALLBACK_POLLING_INTERVAL_MS = 30_000;
const BROADCAST_LISTEN_TYPE = "broadcast";

type RealtimeSubscribeStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

export type ChannelConfig = {
  channelName: string;
  eventType: RealtimeEventType;
  shouldRefresh?: (payload: RealtimeInvalidationPayload) => boolean;
};

export function useRealtimeRefresh(params: {
  enabled: boolean;
  channels: ChannelConfig[];
  refresh: () => Promise<void>;
}): void {
  const refreshRef = useRef(params.refresh);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const fallbackIntervalRef = useRef<number | null>(null);
  const reconnectPendingRef = useRef(false);

  refreshRef.current = params.refresh;

  useEffect(() => {
    if (!params.enabled || params.channels.length === 0) {
      return;
    }

    const supabase = createRealtimeClient();
    let isDisposed = false;
    const channelStatuses = new Map<string, RealtimeSubscribeStatus>();
    const groupedChannels = new Map<string, ChannelConfig[]>();

    for (const config of params.channels) {
      const existing = groupedChannels.get(config.channelName);
      if (existing) {
        existing.push(config);
      } else {
        groupedChannels.set(config.channelName, [config]);
      }
    }

    async function runRefresh(): Promise<void> {
      if (refreshInFlightRef.current) {
        await refreshInFlightRef.current;
        return;
      }

      const promise = refreshRef.current().finally(() => {
        if (refreshInFlightRef.current === promise) {
          refreshInFlightRef.current = null;
        }
      });

      refreshInFlightRef.current = promise;
      await promise;
    }

    function stopFallbackPolling(): void {
      if (fallbackIntervalRef.current === null) {
        return;
      }

      window.clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }

    function startFallbackPolling(): void {
      if (fallbackIntervalRef.current !== null || isDisposed) {
        return;
      }

      fallbackIntervalRef.current = window.setInterval(() => {
        void runRefresh();
      }, FALLBACK_POLLING_INTERVAL_MS);
    }

    function areAllChannelsSubscribed(): boolean {
      return (
        groupedChannels.size > 0 &&
        Array.from(groupedChannels.keys()).every(
          (channelName) => channelStatuses.get(channelName) === "SUBSCRIBED",
        )
      );
    }

    const subscribedChannels = Array.from(groupedChannels.entries()).map(
      ([channelName, configs]) => {
        const channel = supabase.channel(channelName);

        for (const config of configs) {
          channel.on<RealtimeInvalidationPayload>(
            BROADCAST_LISTEN_TYPE,
            { event: config.eventType },
            ({ payload }) => {
              if (isDisposed) {
                return;
              }

              if (config.shouldRefresh && !config.shouldRefresh(payload)) {
                return;
              }

              void runRefresh();
            },
          );
        }

        channel.subscribe((status: RealtimeSubscribeStatus) => {
          if (isDisposed) {
            return;
          }

          channelStatuses.set(channelName, status);

          if (areAllChannelsSubscribed()) {
            stopFallbackPolling();

            if (reconnectPendingRef.current) {
              reconnectPendingRef.current = false;
              void runRefresh();
            }

            return;
          }

          if (status === "CHANNEL_ERROR" || status === "CLOSED" || status === "TIMED_OUT") {
            reconnectPendingRef.current = true;
            startFallbackPolling();
          }
        });

        return channel;
      },
    );

    return () => {
      isDisposed = true;
      stopFallbackPolling();

      for (const channel of subscribedChannels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [params.channels, params.enabled]);
}
