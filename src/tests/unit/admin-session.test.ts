import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies, cookieGet, cookieSet } = vi.hoisted(() => ({
  cookies: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies,
}));

import {
  clearAdminSession,
  createAdminSession,
  requireAdminSession,
} from "@/lib/auth/admin-session";

describe("admin session auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    vi.stubEnv("ADMIN_SESSION_SECRET", "test-admin-session-secret");
    vi.stubEnv("NODE_ENV", "test");

    cookies.mockResolvedValue({
      get: cookieGet,
      set: cookieSet,
    });
  });

  it("creates a signed admin session cookie with the expected attributes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T09:00:00.000Z"));

    await createAdminSession("admin-user-1");

    expect(cookieSet).toHaveBeenCalledTimes(1);
    const [name, value, options] = cookieSet.mock.calls[0];
    const [payloadBase64, signature] = value.split(".");
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));

    expect(name).toBe("freshers_match_admin_session");
    expect(signature).toEqual(expect.any(String));
    expect(payload).toEqual({
      adminUserId: "admin-user-1",
      expiresAt: new Date("2026-04-10T17:00:00.000Z").getTime(),
    });
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    expect(options.expires).toEqual(new Date("2026-04-10T17:00:00.000Z"));
  });

  it("restores the admin user id from a valid signed cookie", async () => {
    await createAdminSession("admin-user-2");
    const [, cookieValue] = cookieSet.mock.calls[0];

    cookieGet.mockReturnValue({
      value: cookieValue,
    });

    await expect(requireAdminSession()).resolves.toEqual({
      adminUserId: "admin-user-2",
    });
  });

  it("rejects when the admin session cookie is missing", async () => {
    cookieGet.mockReturnValue(undefined);

    await expect(requireAdminSession()).rejects.toMatchObject({
      code: "admin_session_missing",
      status: 401,
    });
  });

  it("rejects when the admin session signature is tampered with", async () => {
    await createAdminSession("admin-user-3");
    const [, cookieValue] = cookieSet.mock.calls[0];
    const [payloadBase64, signature] = cookieValue.split(".");
    const tamperedSignature = signature.replace(/.$/, signature.endsWith("a") ? "b" : "a");

    cookieGet.mockReturnValue({
      value: `${payloadBase64}.${tamperedSignature}`,
    });

    await expect(requireAdminSession()).rejects.toMatchObject({
      code: "admin_session_invalid",
      status: 401,
    });
  });

  it("rejects when the admin session is expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T09:00:00.000Z"));

    await createAdminSession("admin-user-4");
    const [, cookieValue] = cookieSet.mock.calls[0];

    vi.setSystemTime(new Date("2026-04-10T17:00:00.001Z"));
    cookieGet.mockReturnValue({
      value: cookieValue,
    });

    await expect(requireAdminSession()).rejects.toMatchObject({
      code: "admin_session_expired",
      status: 401,
    });
  });

  it("clears the admin session cookie by expiring it immediately", async () => {
    await clearAdminSession();

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
