import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, participantShell, useParticipantRuntime, useRankingRealtime } = vi.hoisted(() => ({
  replace: vi.fn(),
  participantShell: vi.fn(),
  useParticipantRuntime: vi.fn(),
  useRankingRealtime: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
  }),
}));

vi.mock("@/components/participant/participant-shell", () => ({
  ParticipantShell: (props: { title: string; children: ReactNode; heartbeatEnabled?: boolean }) => {
    participantShell(props);
    return <div data-testid="participant-shell">{props.children}</div>;
  },
}));

vi.mock("@/hooks/useParticipantRuntime", () => ({
  useParticipantRuntime: () => useParticipantRuntime(),
}));

vi.mock("@/hooks/useRankingRealtime", () => ({
  useRankingRealtime,
}));

import HomePage from "@/app/(participant)/home/page";
import JoinPage from "@/app/(participant)/join/page";
import ParticipantRankingPage from "@/app/(participant)/ranking/page";

function createRuntime() {
  return {
    participantId: "participant-1",
    eventId: "event-1",
    nickname: "Alice",
    status: "registered",
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
  };
}

describe("participant page heartbeat wiring", () => {
  beforeEach(() => {
    replace.mockReset();
    participantShell.mockReset();
    useParticipantRuntime.mockReset();
    useRankingRealtime.mockReset();
    vi.restoreAllMocks();
  });

  it("keeps heartbeat disabled on the join page", () => {
    render(<JoinPage />);

    expect(participantShell).toHaveBeenCalledWith(
      expect.objectContaining({
        heartbeatEnabled: false,
      }),
    );
  });

  it("enables heartbeat on the home page", () => {
    useParticipantRuntime.mockReturnValue({
      state: createRuntime(),
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<HomePage />);

    expect(participantShell).toHaveBeenCalledWith(
      expect.objectContaining({
        heartbeatEnabled: true,
      }),
    );
  });

  it("enables heartbeat on the ranking page", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            eventId: "event-1",
            entries: [],
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    useParticipantRuntime.mockReturnValue({
      state: createRuntime(),
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<ParticipantRankingPage />);

    expect(participantShell).toHaveBeenCalledWith(
      expect.objectContaining({
        heartbeatEnabled: true,
      }),
    );
  });
});
