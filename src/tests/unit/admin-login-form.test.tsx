import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

import { AdminLoginForm } from "@/components/admin/admin-login-form";

describe("AdminLoginForm", () => {
  beforeEach(() => {
    push.mockReset();
    vi.restoreAllMocks();
  });

  it("renders the passcode field and login action", () => {
    render(<AdminLoginForm />);

    expect(screen.getByLabelText("運営パスコード")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログイン" })).toBeInTheDocument();
  });

  it("submits the login request and navigates to the admin dashboard", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            adminUserId: "admin-user-1",
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    render(<AdminLoginForm />);

    await user.type(screen.getByLabelText("運営パスコード"), "freshers-admin");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          passcode: "freshers-admin",
        }),
      });
    });

    expect(push).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("shows an authentication error returned by the API", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "admin_passcode_invalid",
            message: "Admin passcode is invalid.",
          },
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    render(<AdminLoginForm />);

    await user.type(screen.getByLabelText("運営パスコード"), "wrong-passcode");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(
      await screen.findByText("パスコードが違います。もう一度入力してください。"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
