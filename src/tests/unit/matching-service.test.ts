import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];

const { getSupabaseAdminClient, rpc, getParticipantRuntimeState } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  rpc: vi.fn(),
  getParticipantRuntimeState: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

vi.mock("@/lib/services/participant-service", () => ({
  getParticipantRuntimeState,
}));

import {
  chooseOpponent,
  executeCancelQueue,
  executeStartQueue,
  shouldOfferStaffMatch,
  tryCreateNextMatch,
} from "@/lib/services/matching-service";

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

function createTableRow(
  overrides: Partial<TableRow> & Pick<TableRow, "id" | "table_number">,
): TableRow {
  return {
    id: overrides.id,
    event_id: overrides.event_id ?? "event-1",
    table_number: overrides.table_number,
    game_title: overrides.game_title ?? `Table ${overrides.table_number}`,
    status: overrides.status ?? "available",
    current_match_id: overrides.current_match_id ?? null,
    held_by_admin_user_id: overrides.held_by_admin_user_id ?? null,
    created_at: overrides.created_at ?? "2026-04-12T10:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-12T10:00:00.000Z",
  };
}

function createMatchRow(overrides: Partial<MatchRow> & Pick<MatchRow, "id">): MatchRow {
  return {
    id: overrides.id,
    event_id: overrides.event_id ?? "event-1",
    table_id: overrides.table_id ?? "table-1",
    player1_participant_id: overrides.player1_participant_id ?? "participant-1",
    player2_participant_id: overrides.player2_participant_id ?? "participant-2",
    status: overrides.status ?? "reserved",
    is_staff_match: overrides.is_staff_match ?? false,
    staff_operator_id: overrides.staff_operator_id ?? null,
    player1_ready_at: overrides.player1_ready_at ?? null,
    player2_ready_at: overrides.player2_ready_at ?? null,
    started_at: overrides.started_at ?? null,
    agreed_bet_amount: overrides.agreed_bet_amount ?? null,
    dispute_count: overrides.dispute_count ?? 0,
    last_disputed_at: overrides.last_disputed_at ?? null,
    winner_participant_id: overrides.winner_participant_id ?? null,
    winner_claimed_by_participant_id: overrides.winner_claimed_by_participant_id ?? null,
    winner_claimed_at: overrides.winner_claimed_at ?? null,
    completed_at: overrides.completed_at ?? null,
    cancelled_by_participant_id: overrides.cancelled_by_participant_id ?? null,
    void_reason: overrides.void_reason ?? null,
    created_at: overrides.created_at ?? "2026-04-12T10:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-12T10:00:00.000Z",
  };
}

function createSupabaseMock(data: {
  events?: EventRow[];
  participants?: ParticipantRow[];
  tables?: TableRow[];
  matches?: MatchRow[];
}) {
  const rows = {
    events: data.events ?? [],
    participants: data.participants ?? [],
    tables: data.tables ?? [],
    matches: data.matches ?? [],
  };

  function buildQuery<TRow extends Record<string, unknown>>(sourceRows: TRow[]) {
    let currentRows = [...sourceRows];

    const query = {
      eq(column: string, value: unknown) {
        currentRows = currentRows.filter((row) => row[column] === value);
        return query;
      },
      gt(column: string, value: number) {
        currentRows = currentRows.filter((row) => Number(row[column]) > value);
        return query;
      },
      is(column: string, value: null) {
        currentRows = currentRows.filter((row) => row[column] === value);
        return query;
      },
      order(
        column: string,
        options?: {
          ascending?: boolean;
          nullsFirst?: boolean;
        },
      ) {
        const ascending = options?.ascending ?? true;
        const nullsFirst = options?.nullsFirst ?? false;

        currentRows = [...currentRows].sort((left, right) => {
          const leftValue = left[column];
          const rightValue = right[column];

          if (leftValue === rightValue) {
            return 0;
          }

          if (leftValue === null || leftValue === undefined) {
            return nullsFirst ? -1 : 1;
          }

          if (rightValue === null || rightValue === undefined) {
            return nullsFirst ? 1 : -1;
          }

          if (leftValue < rightValue) {
            return ascending ? -1 : 1;
          }

          return ascending ? 1 : -1;
        });

        return query;
      },
      limit(count: number) {
        return Promise.resolve({
          data: currentRows.slice(0, count),
          error: null,
        });
      },
      maybeSingle() {
        return Promise.resolve({
          data: currentRows[0] ?? null,
          error: null,
        });
      },
    };

    return query;
  }

  return {
    rpc,
    from(table: keyof typeof rows) {
      return {
        select() {
          return buildQuery(rows[table] as Array<Record<string, unknown>>);
        },
        update(values: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              const tableRows = rows[table] as Array<Record<string, unknown>>;
              const updatedRows = tableRows
                .map((row) => {
                  if (row[column] !== value) {
                    return null;
                  }

                  Object.assign(row, values);
                  return row;
                })
                .filter((row): row is Record<string, unknown> => row !== null);

              return {
                select() {
                  return Promise.resolve({
                    data: updatedRows.map((row) => ({ id: row.id })),
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("matching service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("starts queueing with a chosen opponent and available table", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        events: [createEventRow()],
        participants: [
          createParticipantRow({
            id: "participant-1",
            nickname: "Alice",
          }),
          createParticipantRow({
            id: "participant-2",
            nickname: "Bob",
            status: "queueing",
            last_non_disconnect_status: "queueing",
            queued_at: "2026-04-12T09:00:00.000Z",
          }),
        ],
        tables: [createTableRow({ id: "table-1", table_number: 1 })],
      }),
    );
    rpc.mockResolvedValue({
      data: [
        {
          match_id: "match-1",
          participant_status: "match_reserved",
        },
      ],
      error: null,
    });
    getParticipantRuntimeState.mockResolvedValue({
      participantId: "participant-1",
      status: "match_reserved",
    });
    vi.spyOn(Math, "random").mockReturnValue(0);

    await expect(
      executeStartQueue({
        participantId: "participant-1",
      }),
    ).resolves.toEqual({
      participantId: "participant-1",
      status: "match_reserved",
    });

    expect(rpc).toHaveBeenCalledWith("start_queue_and_try_match", {
      p_participant_id: "participant-1",
      p_opponent_participant_id: "participant-2",
      p_table_id: "table-1",
    });
    expect(getParticipantRuntimeState).toHaveBeenCalledWith("participant-1");
  });

  it("falls back to legacy start queue RPC args when 3-arg RPC is unavailable", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        events: [createEventRow()],
        participants: [
          createParticipantRow({
            id: "participant-1",
            nickname: "Alice",
          }),
          createParticipantRow({
            id: "participant-2",
            nickname: "Bob",
            status: "queueing",
            last_non_disconnect_status: "queueing",
            queued_at: "2026-04-12T09:00:00.000Z",
          }),
        ],
        tables: [createTableRow({ id: "table-1", table_number: 1 })],
      }),
    );
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: {
          message:
            "Could not find the function public.start_queue_and_try_match(p_participant_id, p_opponent_participant_id, p_table_id) in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            match_id: "match-legacy-1",
            participant_status: "match_reserved",
          },
        ],
        error: null,
      });
    getParticipantRuntimeState.mockResolvedValue({
      participantId: "participant-1",
      status: "match_reserved",
    });
    vi.spyOn(Math, "random").mockReturnValue(0);

    await expect(
      executeStartQueue({
        participantId: "participant-1",
      }),
    ).resolves.toEqual({
      participantId: "participant-1",
      status: "match_reserved",
    });

    expect(rpc).toHaveBeenNthCalledWith(1, "start_queue_and_try_match", {
      p_participant_id: "participant-1",
      p_opponent_participant_id: "participant-2",
      p_table_id: "table-1",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "start_queue_and_try_match", {
      p_participant_id: "participant-1",
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("starts queueing without a match when no opponent exists", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        events: [createEventRow()],
        participants: [
          createParticipantRow({
            id: "participant-1",
            nickname: "Alice",
          }),
        ],
        tables: [createTableRow({ id: "table-1", table_number: 1 })],
      }),
    );
    rpc.mockResolvedValue({
      data: [
        {
          match_id: null,
          participant_status: "queueing",
        },
      ],
      error: null,
    });
    getParticipantRuntimeState.mockResolvedValue({
      participantId: "participant-1",
      status: "queueing",
    });

    await expect(executeStartQueue({ participantId: "participant-1" })).resolves.toEqual({
      participantId: "participant-1",
      status: "queueing",
    });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("starts queueing without a match when no available table exists", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        events: [createEventRow()],
        participants: [
          createParticipantRow({
            id: "participant-1",
            nickname: "Alice",
          }),
          createParticipantRow({
            id: "participant-2",
            nickname: "Bob",
            status: "queueing",
            last_non_disconnect_status: "queueing",
            queued_at: "2026-04-12T09:00:00.000Z",
          }),
        ],
        tables: [
          createTableRow({
            id: "table-1",
            table_number: 1,
            status: "reserved",
            current_match_id: "match-occupied",
          }),
          createTableRow({
            id: "table-2",
            table_number: 2,
            status: "admin_hold",
          }),
        ],
      }),
    );
    rpc.mockResolvedValue({
      data: [
        {
          match_id: null,
          participant_status: "queueing",
        },
      ],
      error: null,
    });
    getParticipantRuntimeState.mockResolvedValue({
      participantId: "participant-1",
      status: "queueing",
    });

    await executeStartQueue({ participantId: "participant-1" });

    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects queue start when participant is already queueing before calling the RPC", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        participants: [
          createParticipantRow({
            id: "participant-1",
            nickname: "Alice",
            status: "queueing",
            last_non_disconnect_status: "queueing",
            queued_at: "2026-04-12T09:00:00.000Z",
          }),
        ],
      }),
    );

    await expect(executeStartQueue({ participantId: "participant-1" })).rejects.toMatchObject({
      code: "participant_status_conflict",
      status: 409,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps start queue RPC conflicts to a 409 error", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        events: [createEventRow()],
        participants: [
          createParticipantRow({
            id: "participant-1",
            nickname: "Alice",
          }),
          createParticipantRow({
            id: "participant-2",
            nickname: "Bob",
            status: "queueing",
            last_non_disconnect_status: "queueing",
            queued_at: "2026-04-12T09:00:00.000Z",
          }),
        ],
        tables: [createTableRow({ id: "table-1", table_number: 1 })],
      }),
    );
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Participant is not in queueable status: match_reserved",
      },
    });

    await expect(executeStartQueue({ participantId: "participant-1" })).rejects.toMatchObject({
      code: "participant_status_conflict",
      status: 409,
    });
  });

  it("cancels queueing through the RPC and reloads the participant runtime", async () => {
    getSupabaseAdminClient.mockReturnValue(createSupabaseMock({}));
    rpc.mockResolvedValue({
      data: [
        {
          participant_status: "registered",
        },
      ],
      error: null,
    });
    getParticipantRuntimeState.mockResolvedValue({
      participantId: "participant-1",
      status: "registered",
    });

    await expect(executeCancelQueue({ participantId: "participant-1" })).resolves.toEqual({
      participantId: "participant-1",
      status: "registered",
    });

    expect(rpc).toHaveBeenCalledWith("cancel_queue", {
      p_participant_id: "participant-1",
    });
    expect(getParticipantRuntimeState).toHaveBeenCalledWith("participant-1");
  });

  it("maps cancel queue conflicts to a 409 error", async () => {
    getSupabaseAdminClient.mockReturnValue(createSupabaseMock({}));
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Participant is not queueing: registered",
      },
    });

    await expect(executeCancelQueue({ participantId: "participant-1" })).rejects.toMatchObject({
      code: "participant_status_conflict",
      status: 409,
    });
  });

  it("creates the next match from queued participants and returns the created match", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        events: [createEventRow()],
        participants: [
          createParticipantRow({
            id: "participant-1",
            nickname: "Alice",
            status: "queueing",
            last_non_disconnect_status: "queueing",
            queued_at: "2026-04-12T09:00:00.000Z",
          }),
          createParticipantRow({
            id: "participant-2",
            nickname: "Bob",
            status: "queueing",
            last_non_disconnect_status: "queueing",
            queued_at: "2026-04-12T09:01:00.000Z",
          }),
        ],
        tables: [
          createTableRow({
            id: "table-1",
            table_number: 1,
          }),
          createTableRow({
            id: "table-2",
            table_number: 2,
            status: "reserved",
            current_match_id: "match-occupied",
          }),
        ],
        matches: [
          createMatchRow({
            id: "match-1",
            table_id: "table-1",
            player1_participant_id: "participant-1",
            player2_participant_id: "participant-2",
          }),
        ],
      }),
    );
    rpc.mockResolvedValue({
      data: [
        {
          match_id: "match-1",
          participant_status: "match_reserved",
        },
      ],
      error: null,
    });
    vi.spyOn(Math, "random").mockReturnValue(0);

    await expect(tryCreateNextMatch("event-1")).resolves.toMatchObject({
      id: "match-1",
      table_id: "table-1",
      player1_participant_id: "participant-1",
      player2_participant_id: "participant-2",
    });

    expect(rpc).toHaveBeenCalledWith("start_queue_and_try_match", {
      p_participant_id: "participant-1",
      p_opponent_participant_id: "participant-2",
      p_table_id: "table-1",
    });
  });

  it("returns null from tryCreateNextMatch when no available table exists", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        events: [createEventRow()],
        participants: [
          createParticipantRow({
            id: "participant-1",
            nickname: "Alice",
            status: "queueing",
            last_non_disconnect_status: "queueing",
            queued_at: "2026-04-12T09:00:00.000Z",
          }),
          createParticipantRow({
            id: "participant-2",
            nickname: "Bob",
            status: "queueing",
            last_non_disconnect_status: "queueing",
            queued_at: "2026-04-12T09:01:00.000Z",
          }),
        ],
        tables: [
          createTableRow({
            id: "table-1",
            table_number: 1,
            status: "in_use",
            current_match_id: "match-occupied",
          }),
        ],
      }),
    );

    await expect(tryCreateNextMatch("event-1")).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns null from tryCreateNextMatch when the queued requester races out of queueing", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        events: [createEventRow()],
        participants: [
          createParticipantRow({
            id: "participant-1",
            nickname: "Alice",
            status: "queueing",
            last_non_disconnect_status: "queueing",
            queued_at: "2026-04-12T09:00:00.000Z",
          }),
          createParticipantRow({
            id: "participant-2",
            nickname: "Bob",
            status: "queueing",
            last_non_disconnect_status: "queueing",
            queued_at: "2026-04-12T09:01:00.000Z",
          }),
        ],
        tables: [createTableRow({ id: "table-1", table_number: 1 })],
      }),
    );
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Participant is not in queueable status: match_reserved",
      },
    });
    vi.spyOn(Math, "random").mockReturnValue(0);

    await expect(tryCreateNextMatch("event-1")).resolves.toBeNull();
  });

  it("avoids the immediate last opponent when other candidates exist", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const opponent = chooseOpponent({
      requesterId: "participant-1",
      queuedParticipants: [
        createParticipantRow({
          id: "participant-1",
          nickname: "Alice",
          status: "queueing",
          last_non_disconnect_status: "queueing",
          last_opponent_participant_id: "participant-2",
          queued_at: "2026-04-12T09:00:00.000Z",
        }),
        createParticipantRow({
          id: "participant-2",
          nickname: "Bob",
          status: "queueing",
          last_non_disconnect_status: "queueing",
          queued_at: "2026-04-12T09:01:00.000Z",
        }),
        createParticipantRow({
          id: "participant-3",
          nickname: "Carol",
          status: "queueing",
          last_non_disconnect_status: "queueing",
          queued_at: "2026-04-12T09:02:00.000Z",
        }),
      ],
    });

    expect(opponent?.id).toBe("participant-3");
  });

  it("falls back to the immediate last opponent when they are the only candidate", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const opponent = chooseOpponent({
      requesterId: "participant-1",
      queuedParticipants: [
        createParticipantRow({
          id: "participant-1",
          nickname: "Alice",
          status: "queueing",
          last_non_disconnect_status: "queueing",
          last_opponent_participant_id: "participant-2",
          queued_at: "2026-04-12T09:00:00.000Z",
        }),
        createParticipantRow({
          id: "participant-2",
          nickname: "Bob",
          status: "queueing",
          last_non_disconnect_status: "queueing",
          queued_at: "2026-04-12T09:01:00.000Z",
        }),
      ],
    });

    expect(opponent?.id).toBe("participant-2");
  });

  it("returns null when no eligible opponent exists", () => {
    expect(
      chooseOpponent({
        requesterId: "participant-1",
        queuedParticipants: [
          createParticipantRow({
            id: "participant-1",
            nickname: "Alice",
            status: "queueing",
            last_non_disconnect_status: "queueing",
            queued_at: "2026-04-12T09:00:00.000Z",
          }),
        ],
      }),
    ).toBeNull();
  });

  it("marks staff match candidates only after the wait threshold elapses", () => {
    const now = new Date("2026-04-12T10:03:00.000Z");

    expect(
      shouldOfferStaffMatch({
        queuedAt: "2026-04-12T10:00:01.000Z",
        now,
        staffMatchWaitSeconds: 180,
      }),
    ).toBe(false);
    expect(
      shouldOfferStaffMatch({
        queuedAt: "2026-04-12T10:00:00.000Z",
        now,
        staffMatchWaitSeconds: 180,
      }),
    ).toBe(true);
    expect(
      shouldOfferStaffMatch({
        queuedAt: "2026-04-12T09:59:00.000Z",
        now,
        staffMatchWaitSeconds: 180,
      }),
    ).toBe(true);
  });
});
