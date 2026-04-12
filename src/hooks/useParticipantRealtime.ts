"use client";

import { useMemo } from "react";

import { useRealtimeRefresh, type ChannelConfig } from "@/hooks/useRealtimeRefresh";
import {
  getMatchChannelName,
  getParticipantChannelName,
  MATCH_REALTIME_EVENT,
  PARTICIPANT_REALTIME_EVENT,
  type RealtimeInvalidationPayload,
} from "@/lib/realtime/channels";

export function useParticipantRealtime(params: {
  enabled: boolean;
  eventId: string;
  participantId: string;
  refresh: () => Promise<void>;
}): void {
  const channels = useMemo<ChannelConfig[]>(
    () => [
      {
        channelName: getParticipantChannelName(params.eventId),
        eventType: PARTICIPANT_REALTIME_EVENT,
        shouldRefresh: (payload: RealtimeInvalidationPayload) =>
          !payload.participantIds || payload.participantIds.includes(params.participantId),
      },
      {
        channelName: getMatchChannelName(params.eventId),
        eventType: MATCH_REALTIME_EVENT,
      },
    ],
    [params.eventId, params.participantId],
  );

  useRealtimeRefresh({
    enabled: params.enabled,
    channels,
    refresh: params.refresh,
  });
}
