import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
  }),
}));

import RootPage from "@/app/page";
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
    turnRole: null,
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

describe("root page", () => {
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

    replace.mockReset();
    vi.restoreAllMocks();
  });

  it("redirects to join when no saved session token exists", async () => {
    render(<RootPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/join");
    });
  });

  it("redirects home-route statuses to /home", async () => {
    window.localStorage.setItem("freshers-match.participant-session-token", "session-token");

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

    render(<RootPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/home");
    });
  });

  it("redirects match-route statuses to /match", async () => {
    window.localStorage.setItem("freshers-match.participant-session-token", "session-token");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: createRuntime("queueing"),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    render(<RootPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/match");
    });
  });

  it("routes disconnected participants using their last non-disconnect status", async () => {
    window.localStorage.setItem("freshers-match.participant-session-token", "session-token");

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

    render(<RootPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/match");
    });
  });

  it("falls back to /home when disconnected state has no last known status", async () => {
    window.localStorage.setItem("freshers-match.participant-session-token", "session-token");

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: createRuntime("disconnected"),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    render(<RootPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/home");
    });
  });

  it("clears the token and redirects to join when restore is unauthorized", async () => {
    window.localStorage.setItem("freshers-match.participant-session-token", "session-token");

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

    render(<RootPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/join");
    });

    expect(getParticipantSessionToken()).toBeNull();
  });

  it("shows only the splash loading UI while restoring", () => {
    window.localStorage.setItem("freshers-match.participant-session-token", "session-token");

    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => undefined));

    render(<RootPage />);

    expect(screen.getByText("参加情報を確認しています")).toBeInTheDocument();
    expect(
      screen.getByText(
        "保存済みのセッションを読み込んでいます。画面が切り替わるまでそのままお待ちください。",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Setup ready")).not.toBeInTheDocument();
  });
});
