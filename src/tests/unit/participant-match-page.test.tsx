import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";

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

function createRuntime(
  status:
    | "queueing"
    | "match_reserved"
    | "ready"
    | "playing"
    | "claiming_win"
    | "awaiting_result_approval"
    | "result_confirmed"
    | "disconnected",
  overrides: Record<string, unknown> = {},
) {
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
      status === "queueing" || status === "disconnected"
        ? null
        : {
            id: "table-1",
            tableNumber: 3,
            gameTitle: "Smash Bros",
            status: "reserved" as const,
          },
    match:
      status === "queueing" || status === "disconnected"
        ? null
        : {
            id: "match-1",
            status:
              status === "match_reserved"
                ? ("reserved" as const)
                : status === "ready"
                  ? ("awaiting_ready" as const)
                  : status === "playing"
                    ? ("in_progress" as const)
                    : status === "claiming_win" || status === "awaiting_result_approval"
                      ? ("winner_claimed" as const)
                      : ("completed" as const),
            isStaffMatch: false,
            agreedBetAmount: 4,
            disputeCount: 0,
          },
    opponent:
      status === "queueing" || status === "disconnected"
        ? null
        : {
            participantId: "participant-2",
            nickname: "Sora",
          },
    turnRole:
      status === "queueing" || status === "disconnected"
        ? null
        : ("first" as const),
    opponentReady: status === "ready",
    winnerParticipantId: status === "result_confirmed" ? "participant-2" : null,
    winnerClaimedByParticipantId:
      status === "awaiting_result_approval" || status === "result_confirmed"
        ? "participant-2"
        : null,
    disqualifiedReason: null,
    resultDelta: status === "result_confirmed" ? -4 : null,
    resultConfirmedAt: status === "result_confirmed" ? "2026-04-12T01:15:00.000Z" : null,
    canStartMatching: false,
    canClaimWin: status === "playing",
    ...overrides,
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
    expect(screen.getByText("あなたは先攻です")).toBeInTheDocument();
  });

  it("renders the ready-state variant inside the match reserved panel", () => {
    useParticipantRuntime.mockReturnValue({
      state: createRuntime("ready"),
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<MatchPage />);

    expect(screen.getByText("相手の準備完了を待っています")).toBeInTheDocument();
    expect(screen.getByText("あなたは先攻です")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "開始前キャンセル" })).not.toBeInTheDocument();
  });

  it("renders the in-progress panel for active matches", () => {
    useParticipantRuntime.mockReturnValue({
      state: createRuntime("playing"),
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<MatchPage />);

    expect(screen.getByText("対戦中です")).toBeInTheDocument();
    expect(screen.getByText("あなたは先攻です")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "勝利を申告する" })).toBeInTheDocument();
  });

  it("does not render a turn role label for staff matches", () => {
    useParticipantRuntime.mockReturnValue({
      state: createRuntime("playing", {
        turnRole: null,
        match: {
          id: "match-1",
          status: "in_progress",
          isStaffMatch: true,
          agreedBetAmount: 4,
          disputeCount: 0,
        },
        opponent: null,
      }),
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<MatchPage />);

    expect(screen.queryByText("あなたは先攻です")).not.toBeInTheDocument();
    expect(screen.queryByText("あなたは後攻です")).not.toBeInTheDocument();
  });

  it("renders the claim wait panel after sending a win claim", () => {
    useParticipantRuntime.mockReturnValue({
      state: createRuntime("claiming_win"),
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<MatchPage />);

    expect(screen.getByText("勝利申告を送りました")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "勝利申告を取り消す" })).toBeInTheDocument();
  });

  it("renders the result approval panel when the opponent has claimed a win", () => {
    useParticipantRuntime.mockReturnValue({
      state: createRuntime("awaiting_result_approval"),
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<MatchPage />);

    expect(screen.getByText("相手の勝利申告を確認してください")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "承認する" })).toBeInTheDocument();
  });

  it("renders the result confirmed panel after a match is completed", () => {
    useParticipantRuntime.mockReturnValue({
      state: createRuntime("result_confirmed"),
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<MatchPage />);

    expect(screen.getByText("結果が確定しました")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "結果を確認して次へ" })).toBeInTheDocument();
  });

  it("shows the reconnecting overlay while the participant is disconnected", () => {
    useParticipantRuntime.mockReturnValue({
      state: createRuntime("disconnected", {
        lastNonDisconnectStatus: "playing",
      }),
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<MatchPage />);

    expect(screen.getByText("再接続中...")).toBeInTheDocument();
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

  it("does not redirect to join on loading-to-loaded transition when runtime is restored", async () => {
    const restoreState: {
      state: ParticipantRuntimeState | null;
      isLoading: boolean;
      refresh: ReturnType<typeof vi.fn>;
    } = {
      state: null,
      isLoading: true,
      refresh: vi.fn(),
    };

    useParticipantRuntime.mockImplementation(() => restoreState);

    const { rerender } = render(<MatchPage />);

    restoreState.state = createRuntime("match_reserved");
    restoreState.isLoading = false;
    rerender(<MatchPage />);

    await waitFor(() => {
      expect(screen.getByText("卓が確定しました。すぐ向かってください")).toBeInTheDocument();
    });
    expect(replace).not.toHaveBeenCalledWith("/join");
  });
});
