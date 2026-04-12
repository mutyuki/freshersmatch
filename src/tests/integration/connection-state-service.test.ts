import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/types";

const { getSupabaseAdminClient } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

import {
  normalizeParticipantConnectionState,
  restoreDisconnectedParticipantIfNeeded,
} from "@/lib/services/connection-state-service";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];

type FakeState = {
  event: EventRow;
  participants: Record<string, ParticipantRow>;
};

function createEventRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: overrides.id ?? "event-1",
    name: overrides.name ?? "Freshers Match",
    venue_code: overrides.venue_code ?? "VENUE",
    initial_chip_balance: overrides.initial_chip_balance ?? 1000,
    fixed_bet_amount: overrides.fixed_bet_amount ?? 100,
    staff_match_wait_seconds: overrides.staff_match_wait_seconds ?? 180,
    disconnect_threshold_seconds: overrides.disconnect_threshold_seconds ?? 60,
    status: overrides.status ?? "active",
    created_at: overrides.created_at ?? "2026-04-12T10:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-12T10:00:00.000Z",
  };
}

function createParticipantRow(
  overrides: Partial<ParticipantRow> & Pick<ParticipantRow, "id" | "nickname">,
): ParticipantRow {
  return {
    id: overrides.id,
    event_id: overrides.event_id ?? "event-1",
    nickname: overrides.nickname,
    status: overrides.status ?? "registered",
    last_non_disconnect_status:
      overrides.last_non_disconnect_status ?? overrides.status ?? "registered",
    chip_balance: overrides.chip_balance ?? 1000,
    current_match_id: overrides.current_match_id ?? null,
    last_opponent_participant_id: overrides.last_opponent_participant_id ?? null,
    queued_at: overrides.queued_at ?? null,
    last_seen_at: overrides.last_seen_at ?? "2026-04-12T10:00:00.000Z",
    disqualified_reason: overrides.disqualified_reason ?? null,
    created_at: overrides.created_at ?? "2026-04-12T10:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-12T10:00:00.000Z",
  };
}

function createDefaultState(): FakeState {
  return {
    event: createEventRow(),
    participants: {
      "participant-1": createParticipantRow({
        id: "participant-1",
        nickname: "Alice",
        status: "playing",
        last_non_disconnect_status: "playing",
        current_match_id: "match-1",
        last_seen_at: "2026-04-12T10:00:00.000Z",
      }),
      "participant-2": createParticipantRow({
        id: "participant-2",
        nickname: "Bob",
        status: "paused",
        last_non_disconnect_status: "paused",
        last_seen_at: "2026-04-12T10:00:00.000Z",
      }),
    },
  };
}

function createSupabaseMock(state: FakeState) {
  return {
    from(table: "participants" | "events") {
      if (table === "participants") {
        return {
          select() {
            return {
              eq(column: string, value: string) {
                const participant =
                  Object.values(state.participants).find(
                    (row) => row[column as keyof ParticipantRow] === value,
                  ) ?? null;

                return {
                  maybeSingle: () =>
                    Promise.resolve({
                      data: participant,
                      error: null,
                    }),
                };
              },
              maybeSingle: () =>
                Promise.resolve({
                  data: null,
                  error: null,
                }),
            };
          },
          update(values: Partial<ParticipantRow>) {
            return {
              eq(column: "id", value: string) {
                const participant = Object.values(state.participants).find(
                  (row) => row[column] === value,
                );

                if (participant) {
                  if (values.status !== undefined) {
                    participant.status = values.status;
                  }

                  if (values.last_non_disconnect_status !== undefined) {
                    participant.last_non_disconnect_status = values.last_non_disconnect_status;
                  }
                }

                return {
                  select: () =>
                    Promise.resolve({
                      data: participant ? [{ id: participant.id }] : [],
                      error: null,
                    }),
                };
              },
            };
          },
        };
      }

      return {
        select() {
          return {
            eq(column: string, value: string) {
              const matchesColumn =
                state.event[column as keyof EventRow] === value ||
                String(state.event[column as keyof EventRow]) === value;

              return {
                eq(nextColumn: string, nextValue: string) {
                  const matchesNextColumn =
                    state.event[nextColumn as keyof EventRow] === nextValue ||
                    String(state.event[nextColumn as keyof EventRow]) === nextValue;

                  return {
                    maybeSingle: () =>
                      Promise.resolve({
                        data: matchesColumn && matchesNextColumn ? state.event : null,
                        error: null,
                      }),
                  };
                },
                maybeSingle: () =>
                  Promise.resolve({
                    data: matchesColumn ? state.event : null,
                    error: null,
                  }),
              };
            },
            maybeSingle: () =>
              Promise.resolve({
                data: state.event,
                error: null,
              }),
          };
        },
      };
    },
  };
}

describe("connection state service", () => {
  let state: FakeState;

  beforeEach(() => {
    state = createDefaultState();
    getSupabaseAdminClient.mockReturnValue(createSupabaseMock(state));
  });

  it("persists disconnected when a progress state exceeds the disconnect threshold", async () => {
    await normalizeParticipantConnectionState({
      participantId: "participant-1",
      now: new Date("2026-04-12T10:01:00.000Z"),
    });

    expect(state.participants["participant-1"].status).toBe("disconnected");
    expect(state.participants["participant-1"].last_non_disconnect_status).toBe("playing");
  });

  it("does not overwrite last_non_disconnect_status when the participant is already disconnected", async () => {
    state.participants["participant-1"].status = "disconnected";
    state.participants["participant-1"].last_non_disconnect_status = "ready";

    await normalizeParticipantConnectionState({
      participantId: "participant-1",
      now: new Date("2026-04-12T10:01:00.000Z"),
    });

    expect(state.participants["participant-1"].status).toBe("disconnected");
    expect(state.participants["participant-1"].last_non_disconnect_status).toBe("ready");
  });

  it("does not disconnect statuses outside the eligible progress set", async () => {
    await normalizeParticipantConnectionState({
      participantId: "participant-2",
      now: new Date("2026-04-12T10:01:00.000Z"),
    });

    expect(state.participants["participant-2"].status).toBe("paused");
    expect(state.participants["participant-2"].last_non_disconnect_status).toBe("paused");
  });

  it("restores a disconnected participant to the last non-disconnect status", async () => {
    state.participants["participant-1"].status = "disconnected";
    state.participants["participant-1"].last_non_disconnect_status = "ready";

    await restoreDisconnectedParticipantIfNeeded({
      participantId: "participant-1",
    });

    expect(state.participants["participant-1"].status).toBe("ready");
    expect(state.participants["participant-1"].last_non_disconnect_status).toBe("ready");
  });

  it("falls back to registered when a disconnected participant has no restore target", async () => {
    state.participants["participant-1"].status = "disconnected";
    state.participants["participant-1"].last_non_disconnect_status = null;

    await restoreDisconnectedParticipantIfNeeded({
      participantId: "participant-1",
    });

    expect(state.participants["participant-1"].status).toBe("registered");
    expect(state.participants["participant-1"].last_non_disconnect_status).toBeNull();
  });
});
