import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MonitorRankingPage from "@/app/monitor/ranking/page";

describe("monitor ranking page", () => {
  it("renders ranking entries without participant highlight", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              participantId: "participant-1",
              nickname: "Alice",
              chipBalance: 30,
              status: "registered",
              rank: 1,
            },
            {
              participantId: "participant-2",
              nickname: "Bob",
              chipBalance: 22,
              status: "disqualified",
              rank: 2,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    render(<MonitorRankingPage />);

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("YOU")).not.toBeInTheDocument();
    expect(screen.getByText("失格")).toBeInTheDocument();
  });

  it("shows an empty state when there are no ranking entries", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    render(<MonitorRankingPage />);

    expect(await screen.findByText("まだランキング対象の参加者がいません。")).toBeInTheDocument();
  });

  it("shows an error message when the ranking API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "ランキングを読み込めませんでした。",
          },
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    render(<MonitorRankingPage />);

    expect(await screen.findByText("ランキングを読み込めませんでした。")).toBeInTheDocument();
  });
});
