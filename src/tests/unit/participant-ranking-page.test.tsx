import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const useParticipantRuntime = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
  }),
}));

vi.mock("@/hooks/useParticipantRuntime", () => ({
  useParticipantRuntime: () => useParticipantRuntime(),
}));

import ParticipantRankingPage from "@/app/(participant)/ranking/page";

describe("participant ranking page", () => {
  beforeEach(() => {
    replace.mockReset();
    useParticipantRuntime.mockReset();
    vi.restoreAllMocks();
  });

  it("shows a loading message while runtime is being restored", () => {
    useParticipantRuntime.mockReturnValue({
      state: null,
      isLoading: true,
      refresh: vi.fn(),
    });

    render(<ParticipantRankingPage />);

    expect(screen.getByText("順位表を確認しています...")).toBeInTheDocument();
  });

  it("redirects to join when there is no active participant state", async () => {
    useParticipantRuntime.mockReturnValue({
      state: null,
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<ParticipantRankingPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/join");
    });
  });

  it("renders ranking entries and highlights the current participant", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              participantId: "participant-1",
              nickname: "Alice",
              chipBalance: 20,
              status: "registered",
              rank: 1,
            },
            {
              participantId: "participant-2",
              nickname: "Bob",
              chipBalance: 12,
              status: "registered",
              rank: 2,
            },
          ],
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
      state: {
        participantId: "participant-2",
        eventId: "event-1",
        nickname: "Bob",
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
      },
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<ParticipantRankingPage />);

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob").closest("article")).toHaveAttribute("aria-current", "true");
  });

  it("shows an error message when the ranking API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "ランキングの取得に失敗しました。",
          },
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    useParticipantRuntime.mockReturnValue({
      state: {
        participantId: "participant-2",
        eventId: "event-1",
        nickname: "Bob",
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
      },
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<ParticipantRankingPage />);

    expect(await screen.findByText("ランキングの取得に失敗しました。")).toBeInTheDocument();
  });
});
