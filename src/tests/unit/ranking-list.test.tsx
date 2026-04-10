import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RankingList } from "@/components/ranking/ranking-list";

const entries = [
  {
    participantId: "participant-1",
    nickname: "Alice",
    chipBalance: 18,
    status: "registered" as const,
    rank: 1,
  },
  {
    participantId: "participant-2",
    nickname: "Bob",
    chipBalance: 18,
    status: "registered" as const,
    rank: 1,
  },
  {
    participantId: "participant-3",
    nickname: "Carol",
    chipBalance: 7,
    status: "disqualified" as const,
    rank: 3,
  },
];

describe("RankingList", () => {
  it("renders ordered rows and preserves shared ranks", () => {
    render(<RankingList entries={entries} />);

    expect(screen.getAllByText("1")).toHaveLength(2);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getAllByText("18")).toHaveLength(2);
  });

  it("highlights only the selected participant row in participant mode", () => {
    render(<RankingList entries={entries} highlightParticipantId="participant-2" />);

    expect(screen.getByText("Bob").closest("article")).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Alice").closest("article")).not.toHaveAttribute("aria-current");
    expect(screen.getByText("YOU")).toBeInTheDocument();
  });

  it("visually distinguishes disqualified participants", () => {
    render(<RankingList entries={entries} />);

    expect(screen.getByText("失格")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
  });
});
