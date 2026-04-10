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

import HomePage from "@/app/(participant)/home/page";

describe("participant home page", () => {
  beforeEach(() => {
    replace.mockReset();
    useParticipantRuntime.mockReset();
  });

  it("shows a loading message while runtime is being restored", () => {
    useParticipantRuntime.mockReturnValue({
      state: null,
      isLoading: true,
      refresh: vi.fn(),
    });

    render(<HomePage />);

    expect(screen.getByText("参加情報を確認しています...")).toBeInTheDocument();
  });

  it("renders runtime-based participant details when state is available", () => {
    useParticipantRuntime.mockReturnValue({
      state: {
        participantId: "participant-1",
        eventId: "event-1",
        nickname: "Alice",
        status: "registered",
        lastNonDisconnectStatus: null,
        chipBalance: 12,
        currentMatchId: null,
        queuedAt: "2026-04-11T10:00:00.000Z",
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

    render(<HomePage />);

    expect(screen.getByText(/Alice\s+さんで参加中です/)).toBeInTheDocument();
    expect(screen.getByText("現在の状態")).toBeInTheDocument();
    expect(screen.getByText("registered")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("redirects to join when there is no active participant state", async () => {
    useParticipantRuntime.mockReturnValue({
      state: null,
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<HomePage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/join");
    });
  });
});
