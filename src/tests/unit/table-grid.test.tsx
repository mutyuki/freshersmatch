import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminTableListItem } from "@/lib/contracts/admin-tables";

const { useAdminTablesRealtime } = vi.hoisted(() => ({
  useAdminTablesRealtime: vi.fn(),
}));

vi.mock("@/hooks/useAdminTablesRealtime", () => ({
  useAdminTablesRealtime,
}));

import { TableGrid } from "@/components/admin/table-grid";

function createTable(
  overrides: Partial<AdminTableListItem> &
    Pick<AdminTableListItem, "tableId" | "tableNumber" | "gameTitle" | "status">,
): AdminTableListItem {
  return {
    tableId: overrides.tableId,
    tableNumber: overrides.tableNumber,
    gameTitle: overrides.gameTitle,
    status: overrides.status,
    currentMatchId: overrides.currentMatchId ?? null,
    occupantNicknames: overrides.occupantNicknames ?? [],
    heldByAdminDisplayName: overrides.heldByAdminDisplayName ?? null,
  };
}

describe("TableGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders the initial table state and subscribes to realtime refresh", () => {
    render(
      <TableGrid
        eventId="event-1"
        initialData={[
          createTable({
            tableId: "table-1",
            tableNumber: 1,
            gameTitle: "SF6",
            status: "admin_hold",
          }),
        ]}
      />,
    );

    expect(screen.getByText("SF6")).toBeInTheDocument();
    expect(screen.getByText("Admin Hold")).toBeInTheDocument();
    expect(useAdminTablesRealtime).toHaveBeenCalledWith({
      enabled: true,
      eventId: "event-1",
      refresh: expect.any(Function),
    });
  });

  it("refreshes the table grid through the admin api", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            createTable({
              tableId: "table-2",
              tableNumber: 2,
              gameTitle: "Tekken 8",
              status: "available",
            }),
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      <TableGrid
        eventId="event-1"
        initialData={[
          createTable({
            tableId: "table-1",
            tableNumber: 1,
            gameTitle: "SF6",
            status: "available",
          }),
        ]}
      />,
    );

    const realtimeArgs = useAdminTablesRealtime.mock.calls[0]?.[0] as {
      refresh: () => Promise<void>;
    };

    await act(async () => {
      await realtimeArgs.refresh();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/admin/tables?eventId=event-1", {
        method: "GET",
      });
      expect(screen.getByText("Tekken 8")).toBeInTheDocument();
    });
  });

  it("submits hold, release hold, and force release actions on confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { ok: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              createTable({
                tableId: "table-1",
                tableNumber: 1,
                gameTitle: "SF6",
                status: "admin_hold",
              }),
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { ok: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              createTable({
                tableId: "table-1",
                tableNumber: 1,
                gameTitle: "SF6",
                status: "available",
              }),
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { ok: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              createTable({
                tableId: "table-1",
                tableNumber: 1,
                gameTitle: "SF6",
                status: "available",
              }),
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    render(
      <TableGrid
        eventId="event-1"
        initialData={[
          createTable({
            tableId: "table-1",
            tableNumber: 1,
            gameTitle: "SF6",
            status: "available",
            currentMatchId: "match-1",
            occupantNicknames: ["Alice", "Bob"],
          }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Hold" }));
    await user.click(screen.getByRole("button", { name: "確認して実行" }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(1, "/api/admin/table/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: "table-1",
          confirm: true,
        }),
      });
    });

    await user.click(screen.getByRole("button", { name: "Hold解除" }));
    await user.click(screen.getByRole("button", { name: "確認して実行" }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(3, "/api/admin/table/release-hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: "table-1",
          confirm: true,
        }),
      });
    });

    cleanup();

    render(
      <TableGrid
        eventId="event-1"
        initialData={[
          createTable({
            tableId: "table-2",
            tableNumber: 2,
            gameTitle: "Tekken 8",
            status: "in_use",
            currentMatchId: "match-9",
            occupantNicknames: ["Carol", "Dave"],
          }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "強制解放" }));
    await user.click(screen.getByRole("button", { name: "確認して実行" }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(5, "/api/admin/table/force-release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: "table-2",
          confirm: true,
        }),
      });
    });
  });
});
