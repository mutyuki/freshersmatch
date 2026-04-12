import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { getActiveEventId, listAdminMatches, listAdminTables, matchTable, tableGrid } = vi.hoisted(
  () => ({
    getActiveEventId: vi.fn(),
    listAdminMatches: vi.fn(),
    listAdminTables: vi.fn(),
    matchTable: vi.fn(),
    tableGrid: vi.fn(),
  }),
);

vi.mock("@/lib/services/admin-dashboard-service", () => ({
  getActiveEventId,
}));

vi.mock("@/lib/services/admin-match-service", () => ({
  listAdminMatches,
  listAdminTables,
}));

vi.mock("@/components/admin/match-table", () => ({
  MatchTable: (props: { eventId: string; initialData: unknown }) => {
    matchTable(props);
    return <div data-testid="match-table">Match table</div>;
  },
}));

vi.mock("@/components/admin/table-grid", () => ({
  TableGrid: (props: { eventId: string; initialData: unknown }) => {
    tableGrid(props);
    return <div data-testid="table-grid">Table grid</div>;
  },
}));

import AdminMatchesPage from "@/app/admin/(protected)/matches/page";
import AdminTablesPage from "@/app/admin/(protected)/tables/page";

describe("admin match and table pages", () => {
  it("loads the active event and renders the match table", async () => {
    getActiveEventId.mockResolvedValue("event-1");
    listAdminMatches.mockResolvedValue([{ matchId: "match-1" }]);

    const result = await AdminMatchesPage();
    render(result);

    expect(screen.getByTestId("match-table")).toBeInTheDocument();
    expect(listAdminMatches).toHaveBeenCalledWith("event-1");
    expect(matchTable).toHaveBeenCalledWith({
      eventId: "event-1",
      initialData: [{ matchId: "match-1" }],
    });
  });

  it("loads the active event and renders the table grid", async () => {
    getActiveEventId.mockResolvedValue("event-1");
    listAdminTables.mockResolvedValue([{ tableId: "table-1" }]);

    const result = await AdminTablesPage();
    render(result);

    expect(screen.getByTestId("table-grid")).toBeInTheDocument();
    expect(listAdminTables).toHaveBeenCalledWith("event-1");
    expect(tableGrid).toHaveBeenCalledWith({
      eventId: "event-1",
      initialData: [{ tableId: "table-1" }],
    });
  });
});
