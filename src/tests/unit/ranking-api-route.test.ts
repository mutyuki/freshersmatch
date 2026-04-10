import { beforeEach, describe, expect, it, vi } from "vitest";

const { listRanking, getSupabaseAdminClient, from, select, eq, maybeSingle } = vi.hoisted(() => ({
  listRanking: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/services/ranking-service", () => ({
  listRanking,
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

import { GET as getRanking } from "@/app/api/ranking/route";
import { AppError } from "@/lib/domain/errors";

describe("ranking api route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSupabaseAdminClient.mockReturnValue({
      from,
    });

    from.mockReturnValue({
      select,
    });

    select.mockReturnValue({
      eq,
    });

    eq.mockReturnValue({
      maybeSingle,
    });
  });

  it("returns wrapped ranking data for the active event", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "event-1" },
      error: null,
    });
    listRanking.mockResolvedValue([
      {
        participantId: "participant-1",
        nickname: "Alice",
        chipBalance: 1500,
        status: "registered",
        rank: 1,
      },
    ]);

    const response = await getRanking(new Request("http://localhost/api/ranking"));

    await expect(response.json()).resolves.toEqual({
      data: [
        {
          participantId: "participant-1",
          nickname: "Alice",
          chipBalance: 1500,
          status: "registered",
          rank: 1,
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(from).toHaveBeenCalledWith("events");
    expect(select).toHaveBeenCalledWith("id");
    expect(eq).toHaveBeenCalledWith("status", "active");
    expect(listRanking).toHaveBeenCalledWith({ eventId: "event-1" });
  });

  it("returns a 404 json error when no active event exists", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const response = await getRanking(new Request("http://localhost/api/ranking"));

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "active_event_not_found",
        message: "Active event was not found.",
      },
    });
    expect(response.status).toBe(404);
    expect(listRanking).not.toHaveBeenCalled();
  });

  it("returns downstream app errors as json", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "event-1" },
      error: null,
    });
    listRanking.mockRejectedValue(
      new AppError("ranking_lookup_failed", "Failed to load ranking.", 500),
    );

    const response = await getRanking(new Request("http://localhost/api/ranking"));

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ranking_lookup_failed",
        message: "Failed to load ranking.",
      },
    });
    expect(response.status).toBe(500);
  });
});
