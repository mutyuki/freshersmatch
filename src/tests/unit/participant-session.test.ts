import { describe, expect, it, vi, beforeEach } from "vitest";

const { maybeSingle, select, eq, updateEq, updateSelect, update, from, getSupabaseAdminClient } =
  vi.hoisted(() => ({
    maybeSingle: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    updateEq: vi.fn(),
    updateSelect: vi.fn(),
    update: vi.fn(),
    from: vi.fn(),
    getSupabaseAdminClient: vi.fn(),
  }));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

import {
  generateParticipantSessionToken,
  hashParticipantSessionToken,
  touchParticipantSession,
  verifyParticipantSession,
} from "@/lib/auth/participant-session";

describe("participant session auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    maybeSingle.mockReset();
    select.mockReset();
    eq.mockReset();
    updateEq.mockReset();
    updateSelect.mockReset();
    update.mockReset();
    from.mockReset();

    getSupabaseAdminClient.mockReturnValue({
      from,
    });

    from.mockImplementation((table: string) => {
      if (table !== "participant_sessions") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select,
        update,
      };
    });

    select.mockReturnValue({
      eq,
    });

    eq.mockReturnValue({
      eq,
      maybeSingle,
    });

    update.mockReturnValue({
      eq: updateEq,
    });

    updateEq.mockReturnValue({
      select: updateSelect,
    });
  });

  it("generates non-empty random session tokens", () => {
    const token1 = generateParticipantSessionToken();
    const token2 = generateParticipantSessionToken();

    expect(token1).toEqual(expect.any(String));
    expect(token1.length).toBeGreaterThanOrEqual(32);
    expect(token1).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token2).toEqual(expect.any(String));
    expect(token2).not.toBe(token1);
  });

  it("hashes the same raw token deterministically", async () => {
    const rawToken = "participant-session-token";

    const firstHash = await hashParticipantSessionToken(rawToken);
    const secondHash = await hashParticipantSessionToken(rawToken);

    expect(firstHash).toBe(secondHash);
    expect(firstHash).not.toBe(rawToken);
    expect(firstHash).toHaveLength(64);
  });

  it("verifies an active participant session and returns the narrowed identity", async () => {
    const rawToken = "active-session-token";
    const hashedToken = await hashParticipantSessionToken(rawToken);

    maybeSingle.mockResolvedValue({
      data: {
        id: "session-1",
        participant_id: "participant-1",
      },
      error: null,
    });

    await expect(verifyParticipantSession(rawToken)).resolves.toEqual({
      participantId: "participant-1",
      sessionId: "session-1",
    });

    expect(from).toHaveBeenCalledWith("participant_sessions");
    expect(select).toHaveBeenCalledWith("id, participant_id");
    expect(eq).toHaveBeenNthCalledWith(1, "session_token_hash", hashedToken);
    expect(eq).toHaveBeenNthCalledWith(2, "is_active", true);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("rejects verification when there is no active participant session", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(verifyParticipantSession("missing-session")).rejects.toMatchObject({
      code: "participant_session_invalid",
      status: 401,
    });
  });

  it("rejects verification when the database query fails", async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: {
        message: "db exploded",
      },
    });

    await expect(verifyParticipantSession("broken-session")).rejects.toMatchObject({
      code: "participant_session_lookup_failed",
      status: 401,
    });
  });

  it("touches last_seen_at for the specified session id", async () => {
    updateSelect.mockResolvedValue({
      data: [{ id: "session-1" }],
      error: null,
    });

    await expect(touchParticipantSession("session-1")).resolves.toBeUndefined();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      last_seen_at: expect.any(String),
    });
    expect(updateEq).toHaveBeenCalledWith("id", "session-1");
    expect(updateSelect).toHaveBeenCalledWith("id");
  });

  it("fails touch when the target session cannot be updated", async () => {
    updateSelect.mockResolvedValue({
      data: [],
      error: null,
    });

    await expect(touchParticipantSession("missing-session")).rejects.toMatchObject({
      code: "participant_session_not_found",
      status: 401,
    });
  });

  it("normalizes touch errors into app errors", async () => {
    updateSelect.mockResolvedValue({
      data: null,
      error: {
        message: "write failed",
      },
    });

    await expect(touchParticipantSession("broken-session")).rejects.toMatchObject({
      code: "participant_session_touch_failed",
      status: 401,
    });
  });
});
