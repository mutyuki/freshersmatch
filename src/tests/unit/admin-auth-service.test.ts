import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminSession, clearAdminSession, getSupabaseAdminClient, from, select, eq } =
  vi.hoisted(() => ({
    createAdminSession: vi.fn(),
    clearAdminSession: vi.fn(),
    getSupabaseAdminClient: vi.fn(),
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
  }));

vi.mock("@/lib/auth/admin-session", () => ({
  createAdminSession,
  clearAdminSession,
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

import { AppError } from "@/lib/domain/errors";
import { loginAdminWithPasscode, logoutAdmin } from "@/lib/services/admin-auth-service";

describe("admin auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getSupabaseAdminClient.mockReturnValue({
      from,
    });

    from.mockImplementation((table: string) => {
      if (table !== "admin_users") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select,
      };
    });

    select.mockReturnValue({
      eq,
    });
  });

  it("creates an admin session when the passcode matches", async () => {
    eq.mockResolvedValue({
      data: [
        {
          id: "admin-user-1",
          passcode_hash:
            "bebc3462afd9bdf4add1a67632fb67fe:10a7bdb78a5a3bd29f528d706689beddc3c04b60cc0bdf02d63e6d8737b7dfe45a5374e5bb4725aa1d2298b6944e25972564a1f45a9cd14d11ca665ca3cb6adb",
        },
      ],
      error: null,
    });
    createAdminSession.mockResolvedValue(undefined);

    await expect(loginAdminWithPasscode({ passcode: "freshers-admin" })).resolves.toEqual({
      adminUserId: "admin-user-1",
    });

    expect(createAdminSession).toHaveBeenCalledWith("admin-user-1");
  });

  it("rejects with 401 when the passcode does not match", async () => {
    eq.mockResolvedValue({
      data: [
        {
          id: "admin-user-1",
          passcode_hash:
            "bebc3462afd9bdf4add1a67632fb67fe:10a7bdb78a5a3bd29f528d706689beddc3c04b60cc0bdf02d63e6d8737b7dfe45a5374e5bb4725aa1d2298b6944e25972564a1f45a9cd14d11ca665ca3cb6adb",
        },
      ],
      error: null,
    });

    await expect(loginAdminWithPasscode({ passcode: "wrong-passcode" })).rejects.toMatchObject({
      code: "admin_passcode_invalid",
      status: 401,
    });
    expect(createAdminSession).not.toHaveBeenCalled();
  });

  it("rejects malformed stored hashes as a server configuration error", async () => {
    eq.mockResolvedValue({
      data: [
        {
          id: "admin-user-1",
          passcode_hash: "bad-format",
        },
      ],
      error: null,
    });

    await expect(loginAdminWithPasscode({ passcode: "freshers-admin" })).rejects.toMatchObject({
      code: "admin_passcode_hash_invalid",
      status: 500,
    });
  });

  it("returns a service error when admin user lookup fails", async () => {
    eq.mockResolvedValue({
      data: null,
      error: {
        message: "db exploded",
      },
    });

    await expect(loginAdminWithPasscode({ passcode: "freshers-admin" })).rejects.toMatchObject({
      code: "admin_user_lookup_failed",
      status: 500,
    });
  });

  it("clears only the current admin session during logout", async () => {
    clearAdminSession.mockResolvedValue(undefined);

    await expect(logoutAdmin()).resolves.toBeUndefined();

    expect(clearAdminSession).toHaveBeenCalledTimes(1);
  });

  it("preserves downstream AppError instances when logout fails", async () => {
    clearAdminSession.mockRejectedValue(
      new AppError("admin_session_clear_failed", "Failed to clear admin session.", 401),
    );

    await expect(logoutAdmin()).rejects.toMatchObject({
      code: "admin_session_clear_failed",
      status: 401,
    });
  });
});
