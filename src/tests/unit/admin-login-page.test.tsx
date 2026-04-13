import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { redirect, requireAdminSession, loginFormClient } = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireAdminSession: vi.fn(),
  loginFormClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession,
}));

vi.mock("@/app/admin/login/login-form-client", () => ({
  LoginFormClient: () => {
    loginFormClient();
    return <div data-testid="admin-login-form">Admin login form</div>;
  },
}));

import AdminLoginPage from "@/app/admin/login/page";

describe("admin login page", () => {
  it("renders the login page when there is no admin session", async () => {
    requireAdminSession.mockRejectedValue(new Error("missing session"));

    const result = await AdminLoginPage();

    render(result);

    expect(screen.getByText("会場運営ログイン")).toBeInTheDocument();
    expect(screen.getByTestId("admin-login-form")).toBeInTheDocument();
    expect(loginFormClient).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to the admin dashboard when already authenticated", async () => {
    const redirectError = new Error("NEXT_REDIRECT");

    requireAdminSession.mockResolvedValue({
      adminUserId: "admin-user-1",
    });
    redirect.mockImplementation(() => {
      throw redirectError;
    });

    await expect(AdminLoginPage()).rejects.toThrow(redirectError);

    expect(redirect).toHaveBeenCalledWith("/admin/dashboard");
  });
});
