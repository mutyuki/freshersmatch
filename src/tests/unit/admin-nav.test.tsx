import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

import { AdminNav } from "@/components/admin/admin-nav";

describe("AdminNav", () => {
  it("renders all admin destinations", () => {
    mockUsePathname.mockReturnValue("/admin/dashboard");

    render(<AdminNav />);

    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/admin/dashboard",
    );
    expect(screen.getByRole("link", { name: /participants/i })).toHaveAttribute(
      "href",
      "/admin/participants",
    );
    expect(screen.getByRole("link", { name: /matches/i })).toHaveAttribute(
      "href",
      "/admin/matches",
    );
    expect(screen.getByRole("link", { name: /tables/i })).toHaveAttribute("href", "/admin/tables");
  });

  it("marks the current section as active", () => {
    mockUsePathname.mockReturnValue("/admin/matches/review");

    render(<AdminNav />);

    expect(screen.getByRole("link", { name: /matches/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /dashboard/i })).not.toHaveAttribute("aria-current");
  });
});
