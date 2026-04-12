import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cookies,
  cookieGet,
  cookieSet,
  getSupabaseAdminClient,
  from,
  insert,
  select,
  eq,
  maybeSingle,
  update,
  updateTokenEq,
  updateTokenActiveEq,
  updateIdEq,
  updateIdActiveEq,
  selectTouchedRows,
} = vi.hoisted(() => ({
  cookies: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  update: vi.fn(),
  updateTokenEq: vi.fn(),
  updateTokenActiveEq: vi.fn(),
  updateIdEq: vi.fn(),
  updateIdActiveEq: vi.fn(),
  selectTouchedRows: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies,
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

import {
  clearAdminSession,
  createAdminSession,
  hashAdminSessionToken,
  requireAdminSession,
} from "@/lib/auth/admin-session";

describe("admin session auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.stubEnv("NODE_ENV", "test");

    cookies.mockResolvedValue({
      get: cookieGet,
      set: cookieSet,
    });

    getSupabaseAdminClient.mockReturnValue({
      from,
    });

    from.mockImplementation((table: string) => {
      if (table !== "admin_sessions") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        insert,
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
      eq: (column: string, value: string) => {
        if (column === "session_token_hash") {
          return updateTokenEq(column, value);
        }

        if (column === "id") {
          return updateIdEq(column, value);
        }

        throw new Error(`Unexpected update eq column: ${column}`);
      },
    });

    updateTokenEq.mockReturnValue({
      eq: updateTokenActiveEq,
    });
    updateIdEq.mockReturnValue({
      eq: updateIdActiveEq,
    });
    updateIdActiveEq.mockReturnValue({
      select: selectTouchedRows,
    });
  });

  it("creates an admin session row and stores the raw token in the cookie", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T09:00:00.000Z"));

    insert.mockResolvedValue({
      data: null,
      error: null,
    });

    await createAdminSession("admin-user-1");

    expect(insert).toHaveBeenCalledTimes(1);
    const insertedRow = insert.mock.calls[0][0];
    const [cookieName, rawToken, options] = cookieSet.mock.calls[0];

    expect(cookieName).toBe("freshers_match_admin_session");
    expect(rawToken).toEqual(expect.any(String));
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(insertedRow).toMatchObject({
      admin_user_id: "admin-user-1",
      is_active: true,
      expires_at: new Date("2026-04-10T17:00:00.000Z").toISOString(),
      invalidated_at: null,
    });
    await expect(hashAdminSessionToken(rawToken)).resolves.toBe(insertedRow.session_token_hash);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    expect(options.expires).toEqual(new Date("2026-04-10T17:00:00.000Z"));
  });

  it("restores the admin user id from an active admin session row", async () => {
    cookieGet.mockReturnValue({
      value: "raw-admin-token",
    });

    maybeSingle.mockResolvedValue({
      data: {
        id: "session-1",
        admin_user_id: "admin-user-2",
        is_active: true,
        expires_at: "2099-01-01T00:00:00.000Z",
      },
      error: null,
    });
    selectTouchedRows.mockResolvedValue({
      data: [{ id: "session-1" }],
      error: null,
    });

    await expect(requireAdminSession()).resolves.toEqual({
      adminUserId: "admin-user-2",
    });

    expect(from).toHaveBeenCalledWith("admin_sessions");
    expect(select).toHaveBeenCalledWith("id, admin_user_id, is_active, expires_at");
    expect(eq).toHaveBeenCalledWith(
      "session_token_hash",
      await hashAdminSessionToken("raw-admin-token"),
    );
    expect(update).toHaveBeenCalledWith({
      last_seen_at: expect.any(String),
    });
    expect(updateIdEq).toHaveBeenCalledWith("id", "session-1");
    expect(updateIdActiveEq).toHaveBeenCalledWith("is_active", true);
    expect(selectTouchedRows).toHaveBeenCalledWith("id");
  });

  it("rejects when the admin session cookie is missing", async () => {
    cookieGet.mockReturnValue(undefined);

    await expect(requireAdminSession()).rejects.toMatchObject({
      code: "admin_session_missing",
      status: 401,
    });
  });

  it("rejects when the admin session row cannot be found", async () => {
    cookieGet.mockReturnValue({
      value: "missing-token",
    });

    maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(requireAdminSession()).rejects.toMatchObject({
      code: "admin_session_invalid",
      status: 401,
    });
  });

  it("rejects when the admin session is inactive", async () => {
    cookieGet.mockReturnValue({
      value: "inactive-token",
    });

    maybeSingle.mockResolvedValue({
      data: {
        id: "session-2",
        admin_user_id: "admin-user-3",
        is_active: false,
        expires_at: "2026-04-10T17:00:00.000Z",
      },
      error: null,
    });

    await expect(requireAdminSession()).rejects.toMatchObject({
      code: "admin_session_invalid",
      status: 401,
    });
  });

  it("rejects when the admin session is expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T17:00:00.001Z"));

    cookieGet.mockReturnValue({
      value: "expired-token",
    });

    maybeSingle.mockResolvedValue({
      data: {
        id: "session-3",
        admin_user_id: "admin-user-4",
        is_active: true,
        expires_at: "2026-04-10T17:00:00.000Z",
      },
      error: null,
    });
    updateTokenActiveEq.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(requireAdminSession()).rejects.toMatchObject({
      code: "admin_session_expired",
      status: 401,
    });

    expect(update).toHaveBeenCalledWith({
      is_active: false,
      invalidated_at: expect.any(String),
    });
    expect(updateTokenEq).toHaveBeenCalledWith(
      "session_token_hash",
      await hashAdminSessionToken("expired-token"),
    );
    expect(updateTokenActiveEq).toHaveBeenCalledWith("is_active", true);
    expect(selectTouchedRows).not.toHaveBeenCalled();
  });

  it("rejects when refreshing admin session activity fails", async () => {
    cookieGet.mockReturnValue({
      value: "touch-error-token",
    });

    maybeSingle.mockResolvedValue({
      data: {
        id: "session-4",
        admin_user_id: "admin-user-5",
        is_active: true,
        expires_at: "2099-01-01T00:00:00.000Z",
      },
      error: null,
    });
    selectTouchedRows.mockResolvedValue({
      data: null,
      error: {
        message: "touch failed",
      },
    });

    await expect(requireAdminSession()).rejects.toMatchObject({
      code: "admin_session_lookup_failed",
      status: 401,
    });
  });

  it("invalidates only the current admin session row and clears the cookie", async () => {
    cookieGet.mockReturnValue({
      value: "logout-token",
    });

    updateTokenActiveEq.mockResolvedValue({
      data: null,
      error: null,
    });

    await clearAdminSession();

    expect(update).toHaveBeenCalledWith({
      is_active: false,
      invalidated_at: expect.any(String),
    });
    expect(updateTokenEq).toHaveBeenCalledWith(
      "session_token_hash",
      await hashAdminSessionToken("logout-token"),
    );
    expect(updateTokenActiveEq).toHaveBeenCalledWith("is_active", true);
    expect(cookieSet).toHaveBeenCalledWith("freshers_match_admin_session", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  });

  it("still clears the cookie when no admin session token is present", async () => {
    cookieGet.mockReturnValue(undefined);

    await expect(clearAdminSession()).resolves.toBeUndefined();

    expect(update).not.toHaveBeenCalled();
    expect(cookieSet).toHaveBeenCalledWith("freshers_match_admin_session", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  });
});
