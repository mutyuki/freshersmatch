import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const push = vi.fn();
const useParticipantRuntime = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
    push,
  }),
}));

vi.mock("@/hooks/useParticipantRuntime", () => ({
  useParticipantRuntime: () => useParticipantRuntime(),
}));

import HomePage from "@/app/(participant)/home/page";

describe("participant home page", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    useParticipantRuntime.mockReset();
    vi.restoreAllMocks();
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

    expect(screen.getByText("ランキングを見る")).toBeInTheDocument();
    expect(screen.getByText("マッチングを開始する")).toBeEnabled();
    expect(screen.getAllByText("参加登録済み")).toHaveLength(2);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(
      screen.getByText(
        "まだ卓は割り当てられていません。準備ができたらマッチング開始を押すと、空いている卓へ順番に案内されます。",
      ),
    ).toBeInTheDocument();
  });

  it("shows a disabled reason when the participant cannot start matching", () => {
    useParticipantRuntime.mockReturnValue({
      state: {
        participantId: "participant-1",
        eventId: "event-1",
        nickname: "Alice",
        status: "paused",
        lastNonDisconnectStatus: null,
        chipBalance: 0,
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
        canStartMatching: false,
        canClaimWin: false,
      },
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<HomePage />);

    expect(screen.getByText("マッチングを開始する")).toBeDisabled();
    expect(
      screen.getByText("チップが 0 のため、次のマッチングを開始できません。"),
    ).toBeInTheDocument();
  });

  it("renders assigned table details when a table is present", () => {
    useParticipantRuntime.mockReturnValue({
      state: {
        participantId: "participant-1",
        eventId: "event-1",
        nickname: "Alice",
        status: "registered",
        lastNonDisconnectStatus: null,
        chipBalance: 12,
        currentMatchId: null,
        queuedAt: null,
        table: {
          id: "table-1",
          tableNumber: 3,
          gameTitle: "Smash Bros",
          status: "reserved",
        },
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

    expect(screen.getByText("3 卓")).toBeInTheDocument();
    expect(screen.getByText("Smash Bros")).toBeInTheDocument();
    expect(screen.getByText("案内中")).toBeInTheDocument();
  });

  it("starts matching through the API and navigates to match on success", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    useParticipantRuntime.mockReturnValue({
      state: {
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
      },
      isLoading: false,
      refresh: vi.fn(),
    });

    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: "マッチングを開始する" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/match");
    });
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
