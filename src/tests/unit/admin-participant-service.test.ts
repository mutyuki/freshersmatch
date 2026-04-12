import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/types";
import { AppError, DomainConflictError } from "@/lib/domain/errors";

const { getSupabaseAdminClient, normalizeParticipantConnectionState, from, rpc } = vi.hoisted(
  () => ({
    getSupabaseAdminClient: vi.fn(),
    normalizeParticipantConnectionState: vi.fn(),
    from: vi.fn(),
    rpc: vi.fn(),
  }),
);

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

vi.mock("@/lib/services/connection-state-service", () => ({
  normalizeParticipantConnectionState,
}));

import {
  adjustParticipantChip,
  disqualifyParticipant,
  listAdminParticipants,
  pauseParticipant,
  unpauseParticipant,
} from "@/lib/services/admin-participant-service";

type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];

function createParticipantRow(
  overrides: Partial<ParticipantRow> & Pick<ParticipantRow, "id" | "nickname">,
): ParticipantRow {
  return {
    id: overrides.id,
    event_id: overrides.event_id ?? "event-1",
    nickname: overrides.nickname,
    status: overrides.status ?? "registered",
    last_non_disconnect_status: overrides.last_non_disconnect_status ?? "registered",
    chip_balance: overrides.chip_balance ?? 10,
    current_match_id: overrides.current_match_id ?? null,
    last_opponent_participant_id: overrides.last_opponent_participant_id ?? null,
    queued_at: overrides.queued_at ?? null,
    last_seen_at: overrides.last_seen_at ?? "2026-04-13T09:00:00.000Z",
    disqualified_reason: overrides.disqualified_reason ?? null,
    created_at: overrides.created_at ?? "2026-04-13T08:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-13T09:00:00.000Z",
  };
}

describe("admin participant service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    normalizeParticipantConnectionState.mockResolvedValue(undefined);
    getSupabaseAdminClient.mockReturnValue({ from, rpc });
  });

  it("lists admin participants after normalizing connection state", async () => {
    const participants = [
      createParticipantRow({
        id: "participant-1",
        nickname: "Alice",
        status: "queueing",
        current_match_id: null,
      }),
      createParticipantRow({
        id: "participant-2",
        nickname: "Bob",
        status: "disqualified",
        disqualified_reason: "rule violation",
      }),
    ];

    from.mockImplementation((tableName: string) => {
      if (tableName !== "participants") {
        throw new Error(`Unexpected table: ${tableName}`);
      }

      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({
                data: participants,
                error: null,
              }),
            }),
          }),
        }),
      };
    });

    await expect(listAdminParticipants("event-1")).resolves.toEqual([
      {
        participantId: "participant-1",
        nickname: "Alice",
        status: "queueing",
        chipBalance: 10,
        currentMatchId: null,
        lastSeenAt: "2026-04-13T09:00:00.000Z",
        disqualifiedReason: null,
      },
      {
        participantId: "participant-2",
        nickname: "Bob",
        status: "disqualified",
        chipBalance: 10,
        currentMatchId: null,
        lastSeenAt: "2026-04-13T09:00:00.000Z",
        disqualifiedReason: "rule violation",
      },
    ]);

    expect(normalizeParticipantConnectionState).toHaveBeenCalledTimes(2);
    expect(normalizeParticipantConnectionState).toHaveBeenNthCalledWith(1, {
      participantId: "participant-1",
      now: expect.any(Date),
    });
  });

  it("maps chip adjust negative balance conflicts", async () => {
    from.mockImplementation((tableName: string) => {
      if (tableName !== "participants") {
        throw new Error(`Unexpected table: ${tableName}`);
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: createParticipantRow({
                id: "participant-1",
                nickname: "Alice",
              }),
              error: null,
            }),
          }),
        }),
      };
    });
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Participant chip balance cannot go negative: participant participant-1",
      },
    });

    await expect(
      adjustParticipantChip({
        adminUserId: "admin-1",
        participantId: "participant-1",
        delta: -11,
        reason: "correction",
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });

  it("returns mutation metadata for pause and disqualify", async () => {
    from.mockImplementation((tableName: string) => {
      if (tableName !== "participants") {
        throw new Error(`Unexpected table: ${tableName}`);
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: createParticipantRow({
                id: "participant-1",
                nickname: "Alice",
                current_match_id: "match-1",
              }),
              error: null,
            }),
          }),
        }),
      };
    });
    rpc
      .mockResolvedValueOnce({
        data: [
          {
            participant_status: "paused",
            affected_match_id: "match-1",
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            participant_status: "disqualified",
            affected_match_id: "match-1",
          },
        ],
        error: null,
      });

    await expect(
      pauseParticipant({
        adminUserId: "admin-1",
        participantId: "participant-1",
      }),
    ).resolves.toEqual({
      eventId: "event-1",
      participantId: "participant-1",
      affectedMatchId: "match-1",
    });

    await expect(
      disqualifyParticipant({
        adminUserId: "admin-1",
        participantId: "participant-1",
        mode: "lose_current_match",
        reason: "rule violation",
      }),
    ).resolves.toEqual({
      eventId: "event-1",
      participantId: "participant-1",
      affectedMatchId: "match-1",
    });
  });

  it("maps not found and conflict errors for unpause and disqualify", async () => {
    from.mockImplementation((tableName: string) => {
      if (tableName !== "participants") {
        throw new Error(`Unexpected table: ${tableName}`);
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: createParticipantRow({
                id: "participant-1",
                nickname: "Alice",
                status: "paused",
              }),
              error: null,
            }),
          }),
        }),
      };
    });
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "Admin user not found: admin-1",
        },
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "Unsupported disqualification mode: wrong",
        },
      });

    await expect(
      unpauseParticipant({
        adminUserId: "admin-1",
        participantId: "participant-1",
      }),
    ).rejects.toEqual(new AppError("admin_user_not_found", "Admin user was not found.", 404));

    await expect(
      disqualifyParticipant({
        adminUserId: "admin-1",
        participantId: "participant-1",
        mode: "void_current_match",
        reason: "reason",
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });
});
