import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, useParticipantHeartbeat, useParticipantRuntime, useRankingRealtime } = vi.hoisted(() => ({
  replace: vi.fn(),
  useParticipantHeartbeat: vi.fn(),
  useParticipantRuntime: vi.fn(),
  useRankingRealtime: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
  }),
}));

vi.mock("@/hooks/useParticipantHeartbeat", () => ({
  useParticipantHeartbeat,
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
    useParticipantHeartbeat.mockReset();
    useParticipantRuntime.mockReset();
    useRankingRealtime.mockReset();
    vi.restoreAllMocks();
  });

  it("keeps heartbeat disabled on the join page", () => {
    render(<JoinPage />);

    expect(useParticipantHeartbeat).not.toHaveBeenCalled();
  });

  it("enables heartbeat on the home page", () => {
    useParticipantRuntime.mockReturnValue({
      state: createRuntime(),
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<HomePage />);

    expect(useParticipantHeartbeat).toHaveBeenCalledWith(true);
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

    expect(useParticipantHeartbeat).toHaveBeenCalledWith(true);
  });
});
