import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StaffMatchForm } from "@/components/admin/staff-match-form";
import type { AdminDashboardData } from "@/lib/contracts/admin-dashboard";

function createDashboardData(overrides: Partial<AdminDashboardData> = {}): AdminDashboardData {
  return {
    eventId: "event-1",
    tables: [
      {
        tableId: "table-1",
        tableNumber: 1,
        gameTitle: "Smash Bros",
        status: "available",
        currentMatchId: null,
        occupantNicknames: [],
        heldByAdminDisplayName: null,
      },
    ],
    queueingParticipants: [
      {
        participantId: "participant-1",
        nickname: "Queue One",
        queuedAt: "2026-04-13T09:00:00.000Z",
        chipBalance: 12,
        isStaffMatchCandidate: true,
      },
    ],
    inProgressMatches: [
      {
        matchId: "match-9",
        tableId: "table-1",
        tableNumber: 1,
        displayStatus: "in_progress",
        participant1Id: "participant-9",
        participant1Nickname: "Staff Battle",
        participant2Nickname: null,
        isStaffMatch: true,
        startedAt: "2026-04-13T09:05:00.000Z",
      },
    ],
    disconnectedParticipants: [],
    disputedMatches: [],
    stalledMatches: [],
    ...overrides,
  };
}

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("StaffMatchForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders queue candidates, available tables, and in-progress staff matches", () => {
    render(<StaffMatchForm data={createDashboardData()} refresh={vi.fn()} />);

    expect(screen.getByText("Queue One")).toBeInTheDocument();
    expect(screen.getByText("Staff Battle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "運営戦を開始する" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "参加者勝利で確定" })).toBeInTheDocument();
  });

  it("starts a staff match and refreshes after success", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue(undefined);

    vi.mocked(global.fetch).mockResolvedValue(
      createJsonResponse({
        data: {
          ok: true,
        },
      }),
    );

    render(<StaffMatchForm data={createDashboardData()} refresh={refresh} />);

    await user.click(screen.getByRole("button", { name: "運営戦を開始する" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/admin/staff-match/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantId: "participant-1",
          tableId: undefined,
          confirm: true,
        }),
      });
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("shows resolution controls only for staff matches and resolves them", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockResolvedValue(undefined);

    vi.mocked(global.fetch).mockResolvedValue(
      createJsonResponse({
        data: {
          ok: true,
        },
      }),
    );

    render(
      <StaffMatchForm
        data={createDashboardData({
          inProgressMatches: [
            {
              matchId: "match-9",
              tableId: "table-1",
              tableNumber: 1,
              displayStatus: "winner_claimed",
              participant1Id: "participant-9",
              participant1Nickname: "Staff Battle",
              participant2Nickname: null,
              isStaffMatch: true,
              startedAt: "2026-04-13T09:05:00.000Z",
            },
            {
              matchId: "match-10",
              tableId: "table-2",
              tableNumber: 2,
              displayStatus: "in_progress",
              participant1Id: "participant-10",
              participant1Nickname: "Normal Match A",
              participant2Nickname: "Normal Match B",
              isStaffMatch: false,
              startedAt: "2026-04-13T09:06:00.000Z",
            },
          ],
        })}
        refresh={refresh}
      />,
    );

    expect(screen.queryByText("Normal Match A")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "参加者敗北で確定" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/admin/staff-match/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          matchId: "match-9",
          participantWon: false,
          confirm: true,
        }),
      });
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });
});
