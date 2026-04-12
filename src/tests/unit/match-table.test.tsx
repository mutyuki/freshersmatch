import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminMatchListItem } from "@/lib/contracts/admin-matches";

const { useAdminMatchesRealtime } = vi.hoisted(() => ({
  useAdminMatchesRealtime: vi.fn(),
}));

vi.mock("@/hooks/useAdminMatchesRealtime", () => ({
  useAdminMatchesRealtime,
}));

import { MatchTable } from "@/components/admin/match-table";

function createMatch(
  overrides: Partial<AdminMatchListItem> &
    Pick<AdminMatchListItem, "matchId" | "participant1Id" | "participant1Nickname" | "status">,
): AdminMatchListItem {
  return {
    matchId: overrides.matchId,
    tableNumber: overrides.tableNumber ?? 1,
    status: overrides.status,
    participant1Id: overrides.participant1Id,
    participant1Nickname: overrides.participant1Nickname,
    participant2Id: overrides.participant2Id ?? "participant-2",
    participant2Nickname: overrides.participant2Nickname ?? "Bob",
    startedAt: overrides.startedAt ?? "2026-04-13T09:00:00.000Z",
    disputeCount: overrides.disputeCount ?? 0,
  };
}

describe("MatchTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders the initial match state and subscribes to realtime refresh", () => {
    render(
      <MatchTable
        eventId="event-1"
        initialData={[
          createMatch({
            matchId: "match-1",
            participant1Id: "participant-1",
            participant1Nickname: "Alice",
            status: "winner_claimed",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("勝利申告中")).toBeInTheDocument();
    expect(useAdminMatchesRealtime).toHaveBeenCalledWith({
      enabled: true,
      eventId: "event-1",
      refresh: expect.any(Function),
    });
  });

  it("refreshes the matches list through the admin api", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            createMatch({
              matchId: "match-2",
              participant1Id: "participant-3",
              participant1Nickname: "Carol",
              status: "in_progress",
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
      <MatchTable
        eventId="event-1"
        initialData={[
          createMatch({
            matchId: "match-1",
            participant1Id: "participant-1",
            participant1Nickname: "Alice",
            status: "reserved",
          }),
        ]}
      />,
    );

    const realtimeArgs = useAdminMatchesRealtime.mock.calls[0]?.[0] as {
      refresh: () => Promise<void>;
    };

    await act(async () => {
      await realtimeArgs.refresh();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/admin/matches?eventId=event-1", {
        method: "GET",
      });
      expect(screen.getByText("Carol")).toBeInTheDocument();
    });
  });

  it("submits winner resolution with the selected winner", async () => {
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
              createMatch({
                matchId: "match-1",
                participant1Id: "participant-1",
                participant1Nickname: "Alice",
                participant2Id: "participant-2",
                participant2Nickname: "Bob",
                status: "force_finished_by_admin",
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
      <MatchTable
        eventId="event-1"
        initialData={[
          createMatch({
            matchId: "match-1",
            participant1Id: "participant-1",
            participant1Nickname: "Alice",
            participant2Id: "participant-2",
            participant2Nickname: "Bob",
            status: "winner_claimed",
          }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "勝敗確定" }));
    await user.click(screen.getByRole("radio", { name: "Bob" }));
    await user.click(screen.getByRole("button", { name: "確認して実行" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        "/api/admin/match/resolve",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    const [, requestInit] = vi.mocked(global.fetch).mock.calls[0] ?? [];
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      matchId: "match-1",
      confirm: true,
      resolutionType: "winner",
      winnerParticipantId: "participant-2",
    });
  });

  it("submits void resolution on explicit confirmation", async () => {
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
              createMatch({
                matchId: "match-1",
                participant1Id: "participant-1",
                participant1Nickname: "Alice",
                status: "voided_by_admin",
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
      <MatchTable
        eventId="event-1"
        initialData={[
          createMatch({
            matchId: "match-1",
            participant1Id: "participant-1",
            participant1Nickname: "Alice",
            status: "reserved",
          }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "試合無効" }));
    await user.click(screen.getByRole("button", { name: "確認して実行" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        "/api/admin/match/resolve",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    const [, requestInit] = vi.mocked(global.fetch).mock.calls[0] ?? [];
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      matchId: "match-1",
      confirm: true,
      resolutionType: "void",
    });
  });
});
