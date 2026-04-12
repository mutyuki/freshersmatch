import { render, screen } from "@testing-library/react";
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

import MatchPage from "@/app/(participant)/match/page";

function createRuntime(status: "queueing" | "match_reserved" | "ready") {
  return {
    participantId: "participant-1",
    eventId: "event-1",
    nickname: "Alice",
    status,
    lastNonDisconnectStatus: null,
    chipBalance: 12,
    currentMatchId: status === "queueing" ? null : "match-1",
    queuedAt: "2026-04-12T01:00:00.000Z",
    table:
      status === "queueing"
        ? null
        : {
            id: "table-1",
            tableNumber: 3,
            gameTitle: "Smash Bros",
            status: "reserved" as const,
          },
    match:
      status === "queueing"
        ? null
        : {
            id: "match-1",
            status: "reserved" as const,
            isStaffMatch: false,
            agreedBetAmount: null,
            disputeCount: 0,
          },
    opponent:
      status === "queueing"
        ? null
        : {
            participantId: "participant-2",
            nickname: "Sora",
          },
    opponentReady: status === "ready",
    winnerParticipantId: null,
    winnerClaimedByParticipantId: null,
    disqualifiedReason: null,
    resultDelta: null,
    resultConfirmedAt: null,
    canStartMatching: false,
    canClaimWin: false,
  };
}

describe("participant match page", () => {
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

    render(<MatchPage />);

    expect(screen.getByText("対戦案内を確認しています...")).toBeInTheDocument();
  });

  it("renders the queue panel for queueing participants", () => {
    useParticipantRuntime.mockReturnValue({
      state: createRuntime("queueing"),
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<MatchPage />);

    expect(screen.getByText("次の卓を探しています")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "待機をやめる" })).toBeInTheDocument();
  });

  it("renders the match reserved panel for reserved participants", () => {
    useParticipantRuntime.mockReturnValue({
      state: createRuntime("match_reserved"),
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<MatchPage />);

    expect(screen.getByText("卓が確定しました。すぐ向かってください")).toBeInTheDocument();
    expect(screen.getByText("3 卓")).toBeInTheDocument();
    expect(screen.getByText("Sora")).toBeInTheDocument();
  });

  it("renders the ready-state variant inside the match reserved panel", () => {
    useParticipantRuntime.mockReturnValue({
      state: createRuntime("ready"),
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<MatchPage />);

    expect(screen.getByText("相手の準備完了を待っています")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "開始前に戻る導線は次タスクで接続予定です" }),
    ).not.toBeInTheDocument();
  });

  it("redirects to join when no participant state is available", () => {
    useParticipantRuntime.mockReturnValue({
      state: null,
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<MatchPage />);

    expect(replace).toHaveBeenCalledWith("/join");
  });
});
