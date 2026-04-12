"use client";

import { useMemo } from "react";

import { useRealtimeRefresh, type ChannelConfig } from "@/hooks/useRealtimeRefresh";
import { ADMIN_REALTIME_EVENT, getAdminChannelName } from "@/lib/realtime/channels";

export function useAdminDashboardRealtime(params: {
  enabled: boolean;
  eventId: string;
  refresh: () => Promise<void>;
}): void {
  const channels = useMemo<ChannelConfig[]>(
    () => [
      {
        channelName: getAdminChannelName(params.eventId),
        eventType: ADMIN_REALTIME_EVENT,
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
