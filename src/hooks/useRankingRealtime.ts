"use client";

import { useMemo } from "react";

import { useRealtimeRefresh, type ChannelConfig } from "@/hooks/useRealtimeRefresh";
import { getRankingChannelName, RANKING_REALTIME_EVENT } from "@/lib/realtime/channels";

export function useRankingRealtime(params: {
  enabled: boolean;
  eventId: string;
  refresh: () => Promise<void>;
}): void {
  const channels = useMemo<ChannelConfig[]>(
    () => [
      {
        channelName: getRankingChannelName(params.eventId),
        eventType: RANKING_REALTIME_EVENT,
      },
    ],
    [params.eventId],
  );

  useRealtimeRefresh({
    enabled: params.enabled,
    channels,
    refresh: params.refresh,
  });
}
