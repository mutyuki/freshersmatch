import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

import { MatchReservedPanel } from "@/components/participant/match-reserved-panel";
import { QueuePanel } from "@/components/participant/queue-panel";

function createRuntime(overrides: Record<string, unknown> = {}) {
  return {
    participantId: "participant-1",
    eventId: "event-1",
    nickname: "Alice",
    status: "queueing" as const,
    lastNonDisconnectStatus: null,
    chipBalance: 12,
    currentMatchId: null,
    queuedAt: "2026-04-12T01:00:00.000Z",
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
    ...overrides,
  };
}

describe("participant match panels", () => {
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
    push.mockReset();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows the elapsed queue time from queuedAt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T01:00:48.000Z"));

    render(
      <QueuePanel
        runtime={createRuntime({
          queuedAt: "2026-04-12T01:00:00.000Z",
        })}
      />,
    );

    expect(screen.getByText("00:48")).toBeInTheDocument();
  });

  it("shows a fallback when queuedAt is missing", () => {
    render(
      <QueuePanel
        runtime={createRuntime({
          queuedAt: null,
        })}
      />,
    );

    expect(screen.getByText("--:--")).toBeInTheDocument();
    expect(
      screen.getByText(
        "待機開始時刻を確認しています。数秒たっても更新されない場合は近くのスタッフへ知らせてください。",
      ),
    ).toBeInTheDocument();
  });

  it("cancels queueing and navigates back home on success", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    render(<QueuePanel runtime={createRuntime()} />);

    await user.click(screen.getByRole("button", { name: "待機をやめる" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/matching/cancel", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
      });
      expect(push).toHaveBeenCalledWith("/home");
    });
  });

  it("shows a cancel error when the API request fails", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "待機終了に失敗しました。",
          },
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    render(<QueuePanel runtime={createRuntime()} />);

    await user.click(screen.getByRole("button", { name: "待機をやめる" }));

    expect(await screen.findByText("待機終了に失敗しました。")).toBeInTheDocument();
  });

  it("renders reserved match details for a normal match", () => {
    render(
      <MatchReservedPanel
        runtime={createRuntime({
          status: "match_reserved",
          currentMatchId: "match-1",
          table: {
            id: "table-1",
            tableNumber: 4,
            gameTitle: "Mario Kart",
            status: "reserved",
          },
          match: {
            id: "match-1",
            status: "reserved",
            isStaffMatch: false,
            agreedBetAmount: null,
            disputeCount: 0,
          },
          opponent: {
            participantId: "participant-2",
            nickname: "Sora",
          },
        })}
      />,
    );

    expect(screen.getByText("4 卓")).toBeInTheDocument();
    expect(screen.getAllByText("Mario Kart")).toHaveLength(2);
    expect(screen.getByText("Sora")).toBeInTheDocument();
  });

  it("renders staff match opponent text for staff matches", () => {
    render(
      <MatchReservedPanel
        runtime={createRuntime({
          status: "match_reserved",
          currentMatchId: "match-1",
          table: {
            id: "table-1",
            tableNumber: 2,
            gameTitle: "Tetris",
            status: "reserved",
          },
          match: {
            id: "match-1",
            status: "reserved",
            isStaffMatch: true,
            agreedBetAmount: null,
            disputeCount: 0,
          },
        })}
      />,
    );

    expect(screen.getByText("運営スタッフ")).toBeInTheDocument();
  });

  it("shows the ready-state primary action and hides cancel", () => {
    render(
      <MatchReservedPanel
        runtime={createRuntime({
          status: "ready",
          currentMatchId: "match-1",
          table: {
            id: "table-1",
            tableNumber: 2,
            gameTitle: "Tetris",
            status: "reserved",
          },
          match: {
            id: "match-1",
            status: "awaiting_ready",
            isStaffMatch: false,
            agreedBetAmount: null,
            disputeCount: 0,
          },
          opponent: {
            participantId: "participant-2",
            nickname: "Mikan",
          },
          opponentReady: true,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "相手の到着を待っています" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "開始前に戻る導線は次タスクで接続予定です" }),
    ).not.toBeInTheDocument();
  });

  it("disables actions and shows a fallback when table data is missing", () => {
    render(
      <MatchReservedPanel
        runtime={createRuntime({
          status: "match_reserved",
          currentMatchId: "match-1",
          match: {
            id: "match-1",
            status: "reserved",
            isStaffMatch: false,
            agreedBetAmount: null,
            disputeCount: 0,
          },
          opponent: {
            participantId: "participant-2",
            nickname: "Mikan",
          },
        })}
      />,
    );

    expect(
      screen.getByText(
        "卓情報を確認しています。数秒たっても卓番号が出ない場合は、近くのスタッフへ声をかけてください。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "開始導線は次タスクで接続予定です" })).toBeDisabled();
  });
});
