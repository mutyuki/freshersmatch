import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { redirect, requireAdminSession, adminShell } = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireAdminSession: vi.fn(),
  adminShell: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession,
}));

vi.mock("@/components/admin/admin-shell", () => ({
  AdminShell: (props: { children: ReactNode }) => {
    adminShell(props);
    return <div data-testid="admin-shell">{props.children}</div>;
  },
}));

import AdminLayout from "@/app/admin/(protected)/layout";

describe("admin protected layout", () => {
  it("wraps protected content when the admin session is valid", async () => {
    requireAdminSession.mockResolvedValue({
      adminUserId: "admin-user-1",
    });

    const result = await AdminLayout({
      children: <div>Protected content</div>,
    });

    expect(requireAdminSession).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
    render(result);
    expect(screen.getByTestId("admin-shell")).toBeInTheDocument();
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(adminShell).toHaveBeenCalledTimes(1);
  });

  it("redirects to the admin login page when the admin session is missing", async () => {
    const redirectError = new Error("NEXT_REDIRECT");

    requireAdminSession.mockRejectedValue(new Error("missing session"));
    redirect.mockImplementation(() => {
      throw redirectError;
    });

    await expect(
      AdminLayout({
        children: <div>Protected content</div>,
      }),
    ).rejects.toThrow(redirectError);

    expect(redirect).toHaveBeenCalledWith("/admin/login");
  });
});
