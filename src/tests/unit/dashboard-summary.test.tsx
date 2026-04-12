import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminDashboardData } from "@/lib/contracts/admin-dashboard";

const { useAdminDashboardRealtime } = vi.hoisted(() => ({
  useAdminDashboardRealtime: vi.fn(),
}));

vi.mock("@/hooks/useAdminDashboardRealtime", () => ({
  useAdminDashboardRealtime,
}));

import { DashboardSummary } from "@/components/admin/dashboard-summary";

function createDashboardData(overrides: Partial<AdminDashboardData> = {}): AdminDashboardData {
  return {
    eventId: "event-1",
    tables: [
      {
        tableId: "table-1",
        tableNumber: 1,
        gameTitle: "Smash Bros",
        status: "in_use",
        currentMatchId: "match-1",
        occupantNicknames: ["Alice", "Bob"],
        heldByAdminDisplayName: null,
      },
      {
        tableId: "table-2",
        tableNumber: 2,
        gameTitle: "Mario Kart",
        status: "admin_hold",
        currentMatchId: null,
        occupantNicknames: [],
        heldByAdminDisplayName: "Desk A",
      },
    ],
    queueingParticipants: [
      {
        participantId: "participant-1",
        nickname: "Queue One",
        queuedAt: "2026-04-13T09:00:00.000Z",
        chipBalance: 12,
        isStaffMatchCandidate: false,
      },
    ],
    inProgressMatches: [
      {
        matchId: "match-1",
        tableNumber: 1,
        displayStatus: "winner_claimed",
        participant1Nickname: "Alice",
        participant2Nickname: "Bob",
        isStaffMatch: false,
        startedAt: "2026-04-13T09:05:00.000Z",
      },
    ],
    disconnectedParticipants: [
      {
        participantId: "participant-2",
        nickname: "Disconnect One",
        lastNonDisconnectStatus: "playing",
        lastSeenAt: "2026-04-13T09:06:00.000Z",
      },
    ],
    disputedMatches: [
      {
        matchId: "match-2",
        tableNumber: 3,
        disputeCount: 2,
        lastDisputedAt: "2026-04-13T09:10:00.000Z",
      },
    ],
    stalledMatches: [
      {
        matchId: "match-1",
        tableNumber: 1,
        status: "winner_claimed",
        winnerClaimedAt: "2026-04-13T09:08:00.000Z",
        startedAt: "2026-04-13T09:05:00.000Z",
        participant1Nickname: "Alice",
        participant2Nickname: "Bob",
      },
    ],
    ...overrides,
  };
}

describe("DashboardSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-04-13T09:12:00.000Z").getTime());
    global.fetch = vi.fn();
  });

  it("renders the initial dashboard state and subscribes to realtime refresh", () => {
    const initialData = createDashboardData();

    render(<DashboardSummary eventId="event-1" initialData={initialData} />);

    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(screen.getByText(/Queue One/)).toBeInTheDocument();
    expect(screen.getByText("Disconnect One")).toBeInTheDocument();
    expect(screen.getAllByText("Alice vs Bob").length).toBeGreaterThan(0);
    expect(useAdminDashboardRealtime).toHaveBeenCalledWith({
      enabled: true,
      eventId: "event-1",
      refresh: expect.any(Function),
    });
  });

  it("refreshes the dashboard through the admin api when realtime invalidation requests it", async () => {
    const initialData = createDashboardData();
    const refreshedData = createDashboardData({
      queueingParticipants: [
        {
          participantId: "participant-9",
          nickname: "Queue Two",
          queuedAt: "2026-04-13T09:11:00.000Z",
          chipBalance: 20,
          isStaffMatchCandidate: true,
        },
      ],
      disconnectedParticipants: [],
      disputedMatches: [],
      stalledMatches: [],
    });

    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: refreshedData }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    render(<DashboardSummary eventId="event-1" initialData={initialData} />);

    const realtimeArgs = useAdminDashboardRealtime.mock.calls[0]?.[0] as {
      refresh: () => Promise<void>;
    };

    await act(async () => {
      await realtimeArgs.refresh();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/admin/dashboard?eventId=event-1", {
        method: "GET",
      });
      expect(screen.getByText(/Queue Two/)).toBeInTheDocument();
    });
  });

  it("keeps the current state visible and shows an error when refresh fails", async () => {
    const initialData = createDashboardData();

    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "refresh failed" } }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    render(<DashboardSummary eventId="event-1" initialData={initialData} />);

    const realtimeArgs = useAdminDashboardRealtime.mock.calls[0]?.[0] as {
      refresh: () => Promise<void>;
    };

    await act(async () => {
      await realtimeArgs.refresh();
    });

    await waitFor(() => {
      expect(screen.getByText("refresh failed")).toBeInTheDocument();
      expect(screen.getByText(/Queue One/)).toBeInTheDocument();
    });
  });
});
