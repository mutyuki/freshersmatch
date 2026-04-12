import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { getActiveEventId, listAdminParticipants, participantTable } = vi.hoisted(() => ({
  getActiveEventId: vi.fn(),
  listAdminParticipants: vi.fn(),
  participantTable: vi.fn(),
}));

vi.mock("@/lib/services/admin-dashboard-service", () => ({
  getActiveEventId,
}));

vi.mock("@/lib/services/admin-participant-service", () => ({
  listAdminParticipants,
}));

vi.mock("@/components/admin/participant-table", () => ({
  ParticipantTable: (props: { eventId: string; initialData: unknown }) => {
    participantTable(props);
    return <div data-testid="participant-table">Participant table</div>;
  },
}));

import AdminParticipantsPage from "@/app/admin/(protected)/participants/page";

describe("admin participants page", () => {
  it("loads the active event and renders the participant table with initial data", async () => {
    const initialData = [
      {
        participantId: "participant-1",
        nickname: "Alice",
        status: "registered",
        chipBalance: 10,
        currentMatchId: null,
        lastSeenAt: "2026-04-13T09:00:00.000Z",
        disqualifiedReason: null,
      },
    ];

    getActiveEventId.mockResolvedValue("event-1");
    listAdminParticipants.mockResolvedValue(initialData);

    const result = await AdminParticipantsPage();

    render(result);

    expect(screen.getByTestId("participant-table")).toBeInTheDocument();
    expect(getActiveEventId).toHaveBeenCalledTimes(1);
    expect(listAdminParticipants).toHaveBeenCalledWith("event-1");
    expect(participantTable).toHaveBeenCalledWith({
      eventId: "event-1",
      initialData,
    });
  });
});
