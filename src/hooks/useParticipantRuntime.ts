"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useParticipantRealtime } from "@/hooks/useParticipantRealtime";
import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";
import { getPreferredParticipantRoute } from "@/lib/participant-route";
import {
  clearParticipantSessionToken,
  getParticipantSessionToken,
} from "@/lib/session/participant-client-session";

type RuntimeResponse = {
  data?: ParticipantRuntimeState;
  error?: {
    code?: string;
    message?: string;
  };
};

function isCurrentRouteCompatible(pathname: string, preferredRoute: "/home" | "/match"): boolean {
  if (pathname === preferredRoute) {
    return true;
  }

  return pathname === "/ranking" && preferredRoute === "/home";
}

function isUnauthorizedResponse(response: Response, payload: RuntimeResponse): boolean {
  return response.status === 401 || payload.error?.code === "participant_session_invalid";
}

async function parseRuntimeResponse(response: Response): Promise<ParticipantRuntimeState> {
  const payload = (await response.json()) as RuntimeResponse;

  if (!response.ok || !payload.data) {
    if (isUnauthorizedResponse(response, payload)) {
      throw new Error("unauthorized");
    }

    throw new Error(payload.error?.message ?? "Failed to load participant runtime.");
  }

  return payload.data;
}

export function useParticipantRuntime(): {
  state: ParticipantRuntimeState | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<ParticipantRuntimeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionTokenRef = useRef<string | null>(null);

  const loadRuntime = useCallback(async (mode: "restore" | "refresh"): Promise<void> => {
    const sessionToken =
      mode === "restore"
        ? getParticipantSessionToken()
        : (sessionTokenRef.current ?? getParticipantSessionToken());

    sessionTokenRef.current = sessionToken;

    if (!sessionToken) {
      setState(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response =
        mode === "restore"
          ? await fetch("/api/participant/session/restore", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sessionToken,
              }),
            })
          : await fetch("/api/participant/me", {
              method: "GET",
              headers: {
                Authorization: `Bearer ${sessionToken}`,
              },
            });

      const nextState = await parseRuntimeResponse(response);
      sessionTokenRef.current = sessionToken;
      setState(nextState);
    } catch (error) {
      if (error instanceof Error && error.message === "unauthorized") {
        clearParticipantSessionToken();
        sessionTokenRef.current = null;
      }

      setState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuntime("restore");
  }, [loadRuntime]);

  useParticipantRealtime({
    enabled: !isLoading && !!state,
    eventId: state?.eventId ?? "",
    participantId: state?.participantId ?? "",
    refresh: async () => {
      await loadRuntime("refresh");
    },
  });

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!state) {
      if (pathname !== "/join") {
        router.replace("/join");
      }

      return;
    }

    const preferredRoute = getPreferredParticipantRoute(
      state.status,
      state.lastNonDisconnectStatus,
    );

    if (!isCurrentRouteCompatible(pathname, preferredRoute)) {
      router.replace(preferredRoute);
    }
  }, [isLoading, pathname, router, state]);

  return {
    state,
    isLoading,
    refresh: async () => {
      await loadRuntime("refresh");
    },
  };
}
