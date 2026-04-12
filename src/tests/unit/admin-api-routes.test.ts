import { beforeEach, describe, expect, it, vi } from "vitest";

const { loginAdminWithPasscode, logoutAdmin } = vi.hoisted(() => ({
  loginAdminWithPasscode: vi.fn(),
  logoutAdmin: vi.fn(),
}));

vi.mock("@/lib/services/admin-auth-service", () => ({
  loginAdminWithPasscode,
  logoutAdmin,
}));

import { AppError } from "@/lib/domain/errors";
import { POST as loginAdminPost } from "@/app/api/admin/login/route";
import { POST as logoutAdminPost } from "@/app/api/admin/logout/route";

describe("admin api routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns wrapped data for admin login", async () => {
    loginAdminWithPasscode.mockResolvedValue({
      adminUserId: "admin-user-1",
    });

    const response = await loginAdminPost(
      new Request("http://localhost/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          passcode: "freshers-admin",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      data: {
        adminUserId: "admin-user-1",
      },
    });
    expect(response.status).toBe(200);
    expect(loginAdminWithPasscode).toHaveBeenCalledWith({
      passcode: "freshers-admin",
    });
  });

  it("returns a 400 json error when login body is invalid", async () => {
    const response = await loginAdminPost(
      new Request("http://localhost/api/admin/login", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_request",
        message: "Request validation failed.",
      },
    });
    expect(response.status).toBe(400);
    expect(loginAdminWithPasscode).not.toHaveBeenCalled();
  });

  it("returns downstream auth failures as json during login", async () => {
    loginAdminWithPasscode.mockRejectedValue(
      new AppError("admin_passcode_invalid", "Admin passcode is invalid.", 401),
    );

    const response = await loginAdminPost(
      new Request("http://localhost/api/admin/login", {
        method: "POST",
        body: JSON.stringify({
          passcode: "wrong-passcode",
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "admin_passcode_invalid",
        message: "Admin passcode is invalid.",
      },
    });
    expect(response.status).toBe(401);
  });

  it("returns ok when logout succeeds", async () => {
    logoutAdmin.mockResolvedValue(undefined);

    const response = await logoutAdminPost();

    await expect(response.json()).resolves.toEqual({
      data: {
        ok: true,
      },
    });
    expect(response.status).toBe(200);
    expect(logoutAdmin).toHaveBeenCalledTimes(1);
  });

  it("returns downstream logout errors as json", async () => {
    logoutAdmin.mockRejectedValue(
      new AppError("admin_session_clear_failed", "Failed to clear admin session.", 401),
    );

    const response = await logoutAdminPost();

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "admin_session_clear_failed",
        message: "Failed to clear admin session.",
      },
    });
    expect(response.status).toBe(401);
  });
});
