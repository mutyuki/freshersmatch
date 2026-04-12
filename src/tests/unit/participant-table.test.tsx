import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminParticipantListItem } from "@/lib/contracts/admin-participants";

const { useAdminParticipantsRealtime } = vi.hoisted(() => ({
  useAdminParticipantsRealtime: vi.fn(),
}));

vi.mock("@/hooks/useAdminParticipantsRealtime", () => ({
  useAdminParticipantsRealtime,
}));

import { ParticipantTable } from "@/components/admin/participant-table";

function createParticipant(
  overrides: Partial<AdminParticipantListItem> &
    Pick<AdminParticipantListItem, "participantId" | "nickname">,
): AdminParticipantListItem {
  return {
    participantId: overrides.participantId,
    nickname: overrides.nickname,
    status: overrides.status ?? "registered",
    chipBalance: overrides.chipBalance ?? 12,
    currentMatchId: overrides.currentMatchId ?? null,
    lastSeenAt: overrides.lastSeenAt ?? "2026-04-13T09:00:00.000Z",
    disqualifiedReason: overrides.disqualifiedReason ?? null,
  };
}

describe("ParticipantTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders the initial participant state and subscribes to realtime refresh", () => {
    render(
      <ParticipantTable
        eventId="event-1"
        initialData={[
          createParticipant({
            participantId: "participant-1",
            nickname: "Alice",
            status: "paused",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("一時停止中")).toBeInTheDocument();
    expect(useAdminParticipantsRealtime).toHaveBeenCalledWith({
      enabled: true,
      eventId: "event-1",
      refresh: expect.any(Function),
    });
  });

  it("refreshes the participants list through the admin api", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            createParticipant({
              participantId: "participant-2",
              nickname: "Bob",
              status: "registered",
            }),
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    render(
      <ParticipantTable
        eventId="event-1"
        initialData={[
          createParticipant({
            participantId: "participant-1",
            nickname: "Alice",
          }),
        ]}
      />,
    );

    const realtimeArgs = useAdminParticipantsRealtime.mock.calls[0]?.[0] as {
      refresh: () => Promise<void>;
    };

    await act(async () => {
      await realtimeArgs.refresh();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/admin/participants?eventId=event-1", {
        method: "GET",
      });
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("opens the chip adjust dialog and only submits on explicit confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { ok: true } }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              createParticipant({
                participantId: "participant-1",
                nickname: "Alice",
                chipBalance: 20,
              }),
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    render(
      <ParticipantTable
        eventId="event-1"
        initialData={[
          createParticipant({
            participantId: "participant-1",
            nickname: "Alice",
          }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "チップ修正" }));

    expect(global.fetch).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("チップ修正量"));
    await user.type(screen.getByLabelText("チップ修正量"), "8");
    await user.type(screen.getByLabelText("チップ修正理由"), "Manual balance correction");
    await user.click(screen.getByRole("button", { name: "確認して実行" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(1, "/api/admin/participant/chip-adjust", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantId: "participant-1",
          delta: 8,
          reason: "Manual balance correction",
          confirm: true,
        }),
      });
    });
  });

  it("switches disqualify modes and includes the selected mode in the request", async () => {
    const user = userEvent.setup();
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { ok: true } }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              createParticipant({
                participantId: "participant-1",
                nickname: "Alice",
                status: "disqualified",
                currentMatchId: "match-1",
                disqualifiedReason: "rule violation",
              }),
            ],
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );

    render(
      <ParticipantTable
        eventId="event-1"
        initialData={[
          createParticipant({
            participantId: "participant-1",
            nickname: "Alice",
            currentMatchId: "match-1",
          }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "失格" }));
    await user.click(screen.getByRole("radio", { name: /敗北扱いで結果確定する/i }));
    await user.type(screen.getByLabelText("失格理由"), "rule violation");
    await user.click(screen.getByRole("button", { name: "確認して実行" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(1, "/api/admin/participant/disqualify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantId: "participant-1",
          mode: "lose_current_match",
          reason: "rule violation",
          confirm: true,
        }),
      });
    });
  });
});
