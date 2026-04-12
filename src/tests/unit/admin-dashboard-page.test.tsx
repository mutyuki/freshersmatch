import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { getActiveEventId, getAdminDashboardData, dashboardSummary } = vi.hoisted(() => ({
  getActiveEventId: vi.fn(),
  getAdminDashboardData: vi.fn(),
  dashboardSummary: vi.fn(),
}));

vi.mock("@/lib/services/admin-dashboard-service", () => ({
  getActiveEventId,
  getAdminDashboardData,
}));

vi.mock("@/components/admin/dashboard-summary", () => ({
  DashboardSummary: (props: { eventId: string; initialData: unknown }) => {
    dashboardSummary(props);
    return <div data-testid="dashboard-summary">Dashboard summary</div>;
  },
}));

import AdminDashboardPage from "@/app/admin/(protected)/dashboard/page";

describe("admin dashboard page", () => {
  it("loads the active event and renders the dashboard summary with initial data", async () => {
    const initialData = {
      eventId: "event-1",
      tables: [],
      queueingParticipants: [],
      inProgressMatches: [],
      disconnectedParticipants: [],
      disputedMatches: [],
      stalledMatches: [],
    };

    getActiveEventId.mockResolvedValue("event-1");
    getAdminDashboardData.mockResolvedValue(initialData);

    const result = await AdminDashboardPage();

    render(result);

    expect(screen.getByTestId("dashboard-summary")).toBeInTheDocument();
    expect(getActiveEventId).toHaveBeenCalledTimes(1);
    expect(getAdminDashboardData).toHaveBeenCalledWith("event-1");
    expect(dashboardSummary).toHaveBeenCalledWith({
      eventId: "event-1",
      initialData,
    });
  });
});
