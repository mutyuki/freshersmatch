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
  updateEq,
  updateActiveEq,
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
  updateEq: vi.fn(),
  updateActiveEq: vi.fn(),
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
      eq: updateEq,
    });

    updateEq.mockReturnValue({
      eq: updateActiveEq,
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
        expires_at: "2026-04-10T17:00:00.000Z",
      },
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

    await expect(requireAdminSession()).rejects.toMatchObject({
      code: "admin_session_expired",
      status: 401,
    });
  });

  it("invalidates only the current admin session row and clears the cookie", async () => {
    cookieGet.mockReturnValue({
      value: "logout-token",
    });

    updateActiveEq.mockResolvedValue({
      data: null,
      error: null,
    });

    await clearAdminSession();

    expect(update).toHaveBeenCalledWith({
      is_active: false,
      invalidated_at: expect.any(String),
    });
    expect(updateEq).toHaveBeenCalledWith(
      "session_token_hash",
      await hashAdminSessionToken("logout-token"),
    );
    expect(updateActiveEq).toHaveBeenCalledWith("is_active", true);
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
