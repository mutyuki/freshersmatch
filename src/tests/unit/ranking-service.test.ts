import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/types";

const { getSupabaseAdminClient, from, select, eq, order } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

import { listRanking } from "@/lib/services/ranking-service";

type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];

function createParticipantRow(
  overrides: Partial<ParticipantRow> & Pick<ParticipantRow, "id" | "nickname" | "chip_balance">,
): ParticipantRow {
  return {
    id: overrides.id,
    event_id: overrides.event_id ?? "event-1",
    nickname: overrides.nickname,
    status: overrides.status ?? "registered",
    last_non_disconnect_status: overrides.last_non_disconnect_status ?? "registered",
    chip_balance: overrides.chip_balance,
    current_match_id: overrides.current_match_id ?? null,
    last_opponent_participant_id: overrides.last_opponent_participant_id ?? null,
    queued_at: overrides.queued_at ?? null,
    last_seen_at: overrides.last_seen_at ?? "2026-04-11T09:00:00.000Z",
    disqualified_reason: overrides.disqualified_reason ?? null,
    created_at: overrides.created_at ?? "2026-04-11T09:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-11T09:00:00.000Z",
  };
}

describe("ranking service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const orderedQuery = {
      order,
    };

    getSupabaseAdminClient.mockReturnValue({
      from,
    });

    from.mockReturnValue({
      select,
    });

    select.mockReturnValue({
      eq,
    });

    eq.mockReturnValue(orderedQuery);
    order.mockImplementationOnce(() => orderedQuery).mockImplementationOnce(() => orderedQuery);
  });

  it("returns ranking entries sorted by chip balance, created_at, then id with shared ranks", async () => {
    order.mockResolvedValue({
      data: [
        createParticipantRow({
          id: "participant-2",
          nickname: "Bravo",
          chip_balance: 1200,
          created_at: "2026-04-11T09:00:00.000Z",
        }),
        createParticipantRow({
          id: "participant-1",
          nickname: "Alpha",
          chip_balance: 1200,
          created_at: "2026-04-11T09:00:00.000Z",
        }),
        createParticipantRow({
          id: "participant-3",
          nickname: "Charlie",
          chip_balance: 900,
          created_at: "2026-04-11T09:01:00.000Z",
          status: "disqualified",
        }),
      ],
      error: null,
    });

    await expect(listRanking({ eventId: "event-1" })).resolves.toEqual([
      {
        participantId: "participant-2",
        nickname: "Bravo",
        chipBalance: 1200,
        status: "registered",
        rank: 1,
      },
      {
        participantId: "participant-1",
        nickname: "Alpha",
        chipBalance: 1200,
        status: "registered",
        rank: 1,
      },
      {
        participantId: "participant-3",
        nickname: "Charlie",
        chipBalance: 900,
        status: "disqualified",
        rank: 3,
      },
    ]);

    expect(from).toHaveBeenCalledWith("participants");
    expect(select).toHaveBeenCalledWith("id,nickname,chip_balance,status,created_at");
    expect(eq).toHaveBeenCalledWith("event_id", "event-1");
    expect(order).toHaveBeenNthCalledWith(1, "chip_balance", { ascending: false });
    expect(order).toHaveBeenNthCalledWith(2, "created_at", { ascending: true });
    expect(order).toHaveBeenNthCalledWith(3, "id", { ascending: true });
  });

  it("returns an empty array when the event has no participants", async () => {
    order.mockResolvedValue({
      data: [],
      error: null,
    });

    await expect(listRanking({ eventId: "event-1" })).resolves.toEqual([]);
  });

  it("throws a 500 app error when the participant query fails", async () => {
    order.mockResolvedValue({
      data: null,
      error: {
        message: "boom",
      },
    });

    await expect(listRanking({ eventId: "event-1" })).rejects.toMatchObject({
      code: "ranking_lookup_failed",
      status: 500,
    });
  });
});
