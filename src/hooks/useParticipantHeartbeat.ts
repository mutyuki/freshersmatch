"use client";

import { useEffect, useRef } from "react";

import { getParticipantSessionToken } from "@/lib/session/participant-client-session";

const PARTICIPANT_HEARTBEAT_INTERVAL_MS = 10_000;

export function useParticipantHeartbeat(enabled: boolean): void {
  const isRequestInFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isDisposed = false;

    async function sendHeartbeat(): Promise<void> {
      if (isDisposed || isRequestInFlightRef.current) {
        return;
      }

      const sessionToken = getParticipantSessionToken();

      if (!sessionToken) {
        return;
      }

      isRequestInFlightRef.current = true;

      try {
        await fetch("/api/participant/heartbeat", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
      } catch {
        // Ignore heartbeat failures so the participant UI keeps running.
      } finally {
        isRequestInFlightRef.current = false;
      }
    }

    void sendHeartbeat();

    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, PARTICIPANT_HEARTBEAT_INTERVAL_MS);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      isRequestInFlightRef.current = false;
    };
  }, [enabled]);
}
