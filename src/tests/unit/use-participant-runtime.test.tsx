import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
  }),
  usePathname: () => mockUsePathname(),
}));

import { useParticipantRuntime } from "@/hooks/useParticipantRuntime";
import { getParticipantSessionToken } from "@/lib/session/participant-client-session";

function createRuntime(status: string, overrides: Record<string, unknown> = {}) {
  return {
    participantId: "participant-1",
    eventId: "event-1",
    nickname: "Alice",
    status,
    lastNonDisconnectStatus: null,
    chipBalance: 12,
    currentMatchId: null,
    queuedAt: null,
    table: null,
    match: null,
    opponent: null,
    opponentReady: false,
    winnerParticipantId: null,
    winnerClaimedByParticipantId: null,
    disqualifiedReason: null,
    resultDelta: null,
    resultConfirmedAt: null,
    canStartMatching: true,
    canClaimWin: false,
    ...overrides,
  };
}

describe("useParticipantRuntime", () => {
  beforeEach(() => {
    const store = new Map<string, string>();

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          store.delete(key);
        }),
        clear: vi.fn(() => {
          store.clear();
        }),
      },
    });

    window.localStorage.setItem("freshers-match.participant-session-token", "session-token");
    mockUsePathname.mockReturnValue("/home");
    replace.mockReset();
    vi.restoreAllMocks();
  });

  it("restores participant runtime on mount with the saved token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: createRuntime("registered"),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const { result } = renderHook(() => useParticipantRuntime());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/participant/session/restore", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionToken: "session-token",
      }),
    });
    expect(result.current.state?.status).toBe("registered");
  });

  it("refreshes runtime via participant/me with bearer authorization", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: createRuntime("registered"),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: createRuntime("paused", { canStartMatching: false }),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    const { result } = renderHook(() => useParticipantRuntime());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/participant/me", {
      method: "GET",
      headers: {
        Authorization: "Bearer session-token",
      },
    });

    await waitFor(() => {
      expect(result.current.state?.status).toBe("paused");
    });
  });

  it("clears the token and navigates to join when restore is unauthorized", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "participant_session_invalid",
            message: "Participant session is invalid.",
          },
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const { result } = renderHook(() => useParticipantRuntime());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.state).toBeNull();
    expect(getParticipantSessionToken()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/join");
  });

  it("redirects home-route statuses away from match pages", async () => {
    mockUsePathname.mockReturnValue("/match");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: createRuntime("registered"),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    renderHook(() => useParticipantRuntime());

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/home");
    });
  });

  it("redirects disconnected participants using lastNonDisconnectStatus", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: createRuntime("disconnected", {
            lastNonDisconnectStatus: "playing",
          }),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    renderHook(() => useParticipantRuntime());

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/match");
    });
  });

  it("keeps participants on the ranking page for home-route statuses", async () => {
    mockUsePathname.mockReturnValue("/ranking");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: createRuntime("registered"),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const { result } = renderHook(() => useParticipantRuntime());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(replace).not.toHaveBeenCalled();
  });
});
