import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
  }),
}));

import { JoinForm } from "@/components/participant/join-form";
import { getParticipantSessionToken } from "@/lib/session/participant-client-session";

describe("JoinForm", () => {
  beforeEach(() => {
    const store = new Map<string, string>();

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          store.delete(key);
        }),
        clear: vi.fn(() => {
          store.clear();
        }),
      },
    });
    push.mockReset();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders venue code, nickname, and a stacked submit action", () => {
    render(<JoinForm />);

    expect(screen.getByLabelText("会場コード")).toBeInTheDocument();
    expect(screen.getByLabelText("ニックネーム")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "この名前で参加する",
      }),
    ).toBeInTheDocument();
  });

  it("submits the registration request, saves the token, and navigates home", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            participant: {
              id: "participant-1",
            },
            sessionToken: "session-token",
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

    render(<JoinForm />);

    await user.type(screen.getByLabelText("会場コード"), "VENUE-1");
    await user.type(screen.getByLabelText("ニックネーム"), "Alice");
    await user.click(screen.getByRole("button", { name: "この名前で参加する" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/participant/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          venueCode: "VENUE-1",
          nickname: "Alice",
        }),
      });
    });

    expect(getParticipantSessionToken()).toBe("session-token");
    expect(push).toHaveBeenCalledWith("/home");
  });

  it("shows a duplicate nickname error returned by the API", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "participant_nickname_conflict",
            message: "Participant nickname is already registered in this event.",
          },
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    render(<JoinForm />);

    await user.type(screen.getByLabelText("会場コード"), "VENUE-1");
    await user.type(screen.getByLabelText("ニックネーム"), "Alice");
    await user.click(screen.getByRole("button", { name: "この名前で参加する" }));

    expect(
      await screen.findByText(
        "そのニックネームはすでに使われています。別の名前で登録してください。",
      ),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows an invalid venue code error returned by the API", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "event_not_found",
            message: "Active event was not found for the venue code.",
          },
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    render(<JoinForm />);

    await user.type(screen.getByLabelText("会場コード"), "NOPE");
    await user.type(screen.getByLabelText("ニックネーム"), "Alice");
    await user.click(screen.getByRole("button", { name: "この名前で参加する" }));

    expect(
      await screen.findByText(
        "会場コードが見つかりません。表示されたコードをもう一度確認してください。",
      ),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("disables the submit button while the request is in flight", async () => {
    const user = userEvent.setup();
    let resolveResponse = (_value: Response): void => {
      throw new Error("Expected pending fetch promise to be set before resolving.");
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );

    render(<JoinForm />);

    await user.type(screen.getByLabelText("会場コード"), "VENUE-1");
    await user.type(screen.getByLabelText("ニックネーム"), "Alice");
    await user.click(screen.getByRole("button", { name: "この名前で参加する" }));

    expect(
      screen.getByRole("button", {
        name: "参加登録しています...",
      }),
    ).toBeDisabled();

    resolveResponse(
      new Response(
        JSON.stringify({
          data: {
            participant: {
              id: "participant-1",
            },
            sessionToken: "session-token",
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

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "この名前で参加する",
        }),
      ).not.toBeDisabled();
    });
  });
});
