import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

import { ClaimWaitPanel } from "@/components/participant/claim-wait-panel";
import { InProgressPanel } from "@/components/participant/in-progress-panel";
import { MatchReservedPanel } from "@/components/participant/match-reserved-panel";
import { QueuePanel } from "@/components/participant/queue-panel";
import { ResultApprovalPanel } from "@/components/participant/result-approval-panel";
import { ResultConfirmedPanel } from "@/components/participant/result-confirmed-panel";

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

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
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(createJsonResponse({ data: {} }));

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
      createJsonResponse(
        {
          error: {
            message: "待機終了に失敗しました。",
          },
        },
        409,
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

  it("starts a reserved match through the ready API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        data: createRuntime({
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
          opponentReady: false,
        }),
      }),
    );

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

    await user.click(screen.getByRole("button", { name: "対戦を開始する" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/match/ready", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: "match-1",
        }),
      });
    });
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
    expect(screen.queryByRole("button", { name: "開始前キャンセル" })).not.toBeInTheDocument();
  });

  it("cancels a reserved match before start and returns home", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        data: {
          ok: true,
        },
      }),
    );

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

    await user.click(screen.getByRole("button", { name: "開始前キャンセル" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/match/cancel-before-start", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: "match-1",
        }),
      });
      expect(push).toHaveBeenCalledWith("/home");
    });
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
    expect(screen.getByRole("button", { name: "対戦を開始する" })).toBeDisabled();
  });

  it("shows a start error when the ready request fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse(
        {
          error: {
            message: "対戦開始に失敗しました。",
          },
        },
        409,
      ),
    );

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

    await user.click(screen.getByRole("button", { name: "対戦を開始する" }));

    expect(await screen.findByText("対戦開始に失敗しました。")).toBeInTheDocument();
  });

  it("submits a win claim from the in-progress panel", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        data: createRuntime({
          status: "claiming_win",
          currentMatchId: "match-1",
          table: {
            id: "table-1",
            tableNumber: 5,
            gameTitle: "Street Fighter 6",
            status: "in_use",
          },
          match: {
            id: "match-1",
            status: "winner_claimed",
            isStaffMatch: false,
            agreedBetAmount: 4,
            disputeCount: 0,
          },
          opponent: {
            participantId: "participant-2",
            nickname: "Sora",
          },
          canClaimWin: false,
        }),
      }),
    );

    render(
      <InProgressPanel
        runtime={createRuntime({
          status: "playing",
          currentMatchId: "match-1",
          table: {
            id: "table-1",
            tableNumber: 5,
            gameTitle: "Street Fighter 6",
            status: "in_use",
          },
          match: {
            id: "match-1",
            status: "in_progress",
            isStaffMatch: false,
            agreedBetAmount: 4,
            disputeCount: 0,
          },
          opponent: {
            participantId: "participant-2",
            nickname: "Sora",
          },
          canClaimWin: true,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "勝利を申告する" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/match/claim-win", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: "match-1",
        }),
      });
    });
  });

  it("shows staff guidance instead of win claim during staff matches", () => {
    render(
      <InProgressPanel
        runtime={createRuntime({
          status: "playing",
          currentMatchId: "match-1",
          table: {
            id: "table-1",
            tableNumber: 1,
            gameTitle: "Tetris",
            status: "in_use",
          },
          match: {
            id: "match-1",
            status: "in_progress",
            isStaffMatch: true,
            agreedBetAmount: 3,
            disputeCount: 0,
          },
        })}
      />,
    );

    expect(screen.getByText("運営戦の結果はスタッフが確定します")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "勝利を申告する" })).not.toBeInTheDocument();
  });

  it("renders the claim wait panel message", () => {
    render(
      <ClaimWaitPanel
        runtime={createRuntime({
          status: "claiming_win",
          currentMatchId: "match-1",
          table: {
            id: "table-1",
            tableNumber: 5,
            gameTitle: "Street Fighter 6",
            status: "in_use",
          },
          match: {
            id: "match-1",
            status: "winner_claimed",
            isStaffMatch: false,
            agreedBetAmount: 4,
            disputeCount: 0,
          },
          opponent: {
            participantId: "participant-2",
            nickname: "Sora",
          },
        })}
      />,
    );

    expect(screen.getByText("勝利申告を送りました")).toBeInTheDocument();
    expect(screen.getByText("相手の承認待ち")).toBeInTheDocument();
  });

  it("approves the opponent result claim", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        data: createRuntime({
          status: "result_confirmed",
          currentMatchId: "match-1",
          table: {
            id: "table-1",
            tableNumber: 3,
            gameTitle: "Smash Bros",
            status: "available",
          },
          match: {
            id: "match-1",
            status: "completed",
            isStaffMatch: false,
            agreedBetAmount: 4,
            disputeCount: 0,
          },
          opponent: {
            participantId: "participant-2",
            nickname: "Sora",
          },
          resultDelta: -4,
          resultConfirmedAt: "2026-04-12T01:15:00.000Z",
        }),
      }),
    );

    render(
      <ResultApprovalPanel
        runtime={createRuntime({
          status: "awaiting_result_approval",
          currentMatchId: "match-1",
          table: {
            id: "table-1",
            tableNumber: 3,
            gameTitle: "Smash Bros",
            status: "in_use",
          },
          match: {
            id: "match-1",
            status: "winner_claimed",
            isStaffMatch: false,
            agreedBetAmount: 4,
            disputeCount: 0,
          },
          opponent: {
            participantId: "participant-2",
            nickname: "Sora",
          },
          winnerClaimedByParticipantId: "participant-2",
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "承認する" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/match/approve-result", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: "match-1",
          approve: true,
        }),
      });
    });
  });

  it("rejects the opponent result claim", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        data: createRuntime({
          status: "playing",
          currentMatchId: "match-1",
          table: {
            id: "table-1",
            tableNumber: 3,
            gameTitle: "Smash Bros",
            status: "in_use",
          },
          match: {
            id: "match-1",
            status: "in_progress",
            isStaffMatch: false,
            agreedBetAmount: 4,
            disputeCount: 1,
          },
          opponent: {
            participantId: "participant-2",
            nickname: "Sora",
          },
          canClaimWin: true,
        }),
      }),
    );

    render(
      <ResultApprovalPanel
        runtime={createRuntime({
          status: "awaiting_result_approval",
          currentMatchId: "match-1",
          table: {
            id: "table-1",
            tableNumber: 3,
            gameTitle: "Smash Bros",
            status: "in_use",
          },
          match: {
            id: "match-1",
            status: "winner_claimed",
            isStaffMatch: false,
            agreedBetAmount: 4,
            disputeCount: 0,
          },
          opponent: {
            participantId: "participant-2",
            nickname: "Sora",
          },
          winnerClaimedByParticipantId: "participant-2",
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "承認しない" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/match/approve-result", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: "match-1",
          approve: false,
        }),
      });
    });
  });

  it("shows an approval error when the API request fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse(
        {
          error: {
            message: "結果承認に失敗しました。",
          },
        },
        409,
      ),
    );

    render(
      <ResultApprovalPanel
        runtime={createRuntime({
          status: "awaiting_result_approval",
          currentMatchId: "match-1",
          table: {
            id: "table-1",
            tableNumber: 3,
            gameTitle: "Smash Bros",
            status: "in_use",
          },
          match: {
            id: "match-1",
            status: "winner_claimed",
            isStaffMatch: false,
            agreedBetAmount: 4,
            disputeCount: 0,
          },
          opponent: {
            participantId: "participant-2",
            nickname: "Sora",
          },
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "承認する" }));

    expect(await screen.findByText("結果承認に失敗しました。")).toBeInTheDocument();
  });

  it("acknowledges a confirmed result and returns home", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        data: createRuntime({
          status: "registered",
          currentMatchId: null,
        }),
      }),
    );

    render(
      <ResultConfirmedPanel
        runtime={createRuntime({
          status: "result_confirmed",
          currentMatchId: "match-1",
          resultDelta: 8,
          resultConfirmedAt: "2026-04-12T01:15:00.000Z",
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "結果を確認して次へ" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/participant/result/ack", {
        method: "POST",
        headers: {
          Authorization: "Bearer session-token",
        },
      });
      expect(push).toHaveBeenCalledWith("/home");
    });
  });

  it("shows an acknowledge error when result confirmation fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse(
        {
          error: {
            message: "結果確認に失敗しました。",
          },
        },
        409,
      ),
    );

    render(
      <ResultConfirmedPanel
        runtime={createRuntime({
          status: "result_confirmed",
          currentMatchId: "match-1",
          resultDelta: -4,
          resultConfirmedAt: "2026-04-12T01:15:00.000Z",
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "結果を確認して次へ" }));

    expect(await screen.findByText("結果確認に失敗しました。")).toBeInTheDocument();
  });
});
