import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/db/types";
import { DomainConflictError } from "@/lib/domain/errors";

const {
  getSupabaseAdminClient,
  normalizeParticipantConnectionState,
  restoreDisconnectedParticipantIfNeeded,
} = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  normalizeParticipantConnectionState: vi.fn(),
  restoreDisconnectedParticipantIfNeeded: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  getSupabaseAdminClient,
}));

vi.mock("@/lib/services/connection-state-service", () => ({
  normalizeParticipantConnectionState,
  restoreDisconnectedParticipantIfNeeded,
}));

import {
  hashParticipantSessionToken,
  verifyParticipantSession,
} from "@/lib/auth/participant-session";
import { registerParticipant, restoreParticipantSession } from "@/lib/services/participant-service";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type ChipLedgerRow = Database["public"]["Tables"]["chip_ledger"]["Row"];
type ParticipantSessionRow = Database["public"]["Tables"]["participant_sessions"]["Row"];
type RegisterParticipantRpcRow =
  Database["public"]["Functions"]["register_participant_and_issue_session"]["Returns"][number];

type FakeState = {
  event: EventRow;
  participants: Record<string, ParticipantRow>;
  participantSessions: Record<string, ParticipantSessionRow>;
  matches: Record<string, MatchRow>;
  tables: Record<string, TableRow>;
  chipLedger: ChipLedgerRow[];
  nowCounter: number;
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

function createParticipantSessionRow(
  overrides: Partial<ParticipantSessionRow> &
    Pick<ParticipantSessionRow, "id" | "participant_id" | "session_token_hash">,
): ParticipantSessionRow {
  return {
    id: overrides.id,
    participant_id: overrides.participant_id,
    session_token_hash: overrides.session_token_hash,
    is_active: overrides.is_active ?? true,
    issued_at: overrides.issued_at ?? "2026-04-12T10:00:00.000Z",
    invalidated_at: overrides.invalidated_at ?? null,
    last_seen_at: overrides.last_seen_at ?? "2026-04-12T10:00:00.000Z",
  };
}

function createDefaultState(): FakeState {
  return {
    event: createEventRow(),
    participants: {},
    participantSessions: {},
    matches: {},
    tables: {},
    chipLedger: [],
    nowCounter: 0,
  };
}

function nextTimestamp(state: FakeState): string {
  state.nowCounter += 1;
  return `2026-04-12T10:00:${String(state.nowCounter).padStart(2, "0")}.000Z`;
}

function createSupabaseMock(state: FakeState) {
  function registerParticipantAndIssueSession(args: {
    p_venue_code: string;
    p_nickname: string;
    p_session_token_hash: string;
  }): RegisterParticipantRpcRow {
    if (args.p_venue_code !== state.event.venue_code || state.event.status !== "active") {
      throw new Error(`Active event not found for venue code: ${args.p_venue_code}`);
    }

    const duplicate = Object.values(state.participants).find(
      (participant) => participant.nickname === args.p_nickname,
    );

    if (duplicate) {
      throw new Error(
        `Participant nickname is already registered in this event: ${args.p_nickname}`,
      );
    }

    const participantId = `participant-${Object.keys(state.participants).length + 1}`;
    const sessionId = `session-${Object.keys(state.participantSessions).length + 1}`;
    const now = nextTimestamp(state);
    const participant = createParticipantRow({
      id: participantId,
      nickname: args.p_nickname,
      event_id: state.event.id,
      chip_balance: state.event.initial_chip_balance,
      created_at: now,
      updated_at: now,
      last_seen_at: now,
    });

    state.participants[participantId] = participant;
    state.participantSessions[sessionId] = createParticipantSessionRow({
      id: sessionId,
      participant_id: participantId,
      session_token_hash: args.p_session_token_hash,
      issued_at: now,
      last_seen_at: now,
    });

    return {
      participant_id: participantId,
      event_id: state.event.id,
      session_id: sessionId,
      chip_balance: participant.chip_balance,
    };
  }

  return {
    from(
      table:
        | "events"
        | "participants"
        | "matches"
        | "tables"
        | "chip_ledger"
        | "participant_sessions",
    ) {
      if (table === "events") {
        return {
          select() {
            return {
              eq(column: string, value: string) {
                const matches = state.event[column as keyof EventRow] === value;

                return {
                  maybeSingle: () =>
                    Promise.resolve({
                      data: matches ? state.event : null,
                      error: null,
                    }),
                };
              },
            };
          },
        };
      }

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
                  select: () =>
                    Promise.resolve({
                      data: participant ? [participant] : [],
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
          update(
            values: Pick<Database["public"]["Tables"]["participants"]["Update"], "last_seen_at">,
          ) {
            return {
              eq(_column: "id", value: string) {
                const participant = state.participants[value];

                if (participant && values.last_seen_at !== undefined) {
                  participant.last_seen_at = values.last_seen_at;
                  participant.updated_at = values.last_seen_at;
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

      if (table === "matches" || table === "tables") {
        return {
          select() {
            return {
              eq(column: string, value: string) {
                const rows = table === "matches" ? state.matches : state.tables;
                const record =
                  Object.values(rows).find((row) => row[column as never] === value) ?? null;

                return {
                  maybeSingle: () =>
                    Promise.resolve({
                      data: record,
                      error: null,
                    }),
                };
              },
            };
          },
        };
      }

      if (table === "chip_ledger") {
        return {
          select() {
            return {
              eq(column: string, value: string) {
                const firstPass = state.chipLedger.filter(
                  (entry) => entry[column as keyof ChipLedgerRow] === value,
                );

                return {
                  eq(nextColumn: string, nextValue: string) {
                    return Promise.resolve({
                      data: firstPass.filter(
                        (entry) => entry[nextColumn as keyof ChipLedgerRow] === nextValue,
                      ),
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      return {
        select() {
          return {
            eq(column: "session_token_hash" | "is_active", value: string | boolean) {
              const initialRows = Object.values(state.participantSessions).filter(
                (row) => row[column] === value,
              );

              return {
                eq(nextColumn: "session_token_hash" | "is_active", nextValue: string | boolean) {
                  const record = initialRows.find((row) => row[nextColumn] === nextValue) ?? null;

                  return {
                    maybeSingle: () =>
                      Promise.resolve({
                        data: record
                          ? {
                              id: record.id,
                              participant_id: record.participant_id,
                            }
                          : null,
                        error: null,
                      }),
                  };
                },
              };
            },
          };
        },
        update(
          values: Pick<
            Database["public"]["Tables"]["participant_sessions"]["Update"],
            "last_seen_at"
          >,
        ) {
          return {
            eq(_column: "id", value: string) {
              const session = state.participantSessions[value];

              if (session && values.last_seen_at !== undefined) {
                session.last_seen_at = values.last_seen_at;
              }

              return {
                select: () =>
                  Promise.resolve({
                    data: session ? [{ id: session.id }] : [],
                    error: null,
                  }),
              };
            },
          };
        },
      };
    },
    rpc(
      fn: "register_participant_and_issue_session",
      args: {
        p_venue_code: string;
        p_nickname: string;
        p_session_token_hash: string;
      },
    ) {
      try {
        if (fn !== "register_participant_and_issue_session") {
          throw new Error(`Unexpected RPC: ${fn}`);
        }

        return Promise.resolve({
          data: [registerParticipantAndIssueSession(args)],
          error: null,
        });
      } catch (error) {
        return Promise.resolve({
          data: null,
          error: {
            message: error instanceof Error ? error.message : "Unknown RPC error",
          },
        });
      }
    },
  };
}

async function replaceParticipantSession(params: {
  state: FakeState;
  participantId: string;
  rawToken: string;
}): Promise<string> {
  const hashedToken = await hashParticipantSessionToken(params.rawToken);
  const now = nextTimestamp(params.state);

  for (const session of Object.values(params.state.participantSessions)) {
    if (session.participant_id === params.participantId && session.is_active) {
      session.is_active = false;
      session.invalidated_at = now;
      session.last_seen_at = now;
    }
  }

  const sessionId = `session-${Object.keys(params.state.participantSessions).length + 1}`;
  params.state.participantSessions[sessionId] = createParticipantSessionRow({
    id: sessionId,
    participant_id: params.participantId,
    session_token_hash: hashedToken,
    issued_at: now,
    last_seen_at: now,
  });

  return sessionId;
}

describe("participant flow", () => {
  let state: FakeState;

  beforeEach(() => {
    state = createDefaultState();
    getSupabaseAdminClient.mockReturnValue(createSupabaseMock(state));
    normalizeParticipantConnectionState.mockResolvedValue(undefined);
    restoreDisconnectedParticipantIfNeeded.mockResolvedValue(false);
  });

  it("rejects duplicate nicknames without mutating participant, match, table, or ledger state", async () => {
    const existingTokenHash = await hashParticipantSessionToken("existing-token");
    state.participants["participant-1"] = createParticipantRow({
      id: "participant-1",
      nickname: "Alice",
    });
    state.participantSessions["session-1"] = createParticipantSessionRow({
      id: "session-1",
      participant_id: "participant-1",
      session_token_hash: existingTokenHash,
    });

    await expect(
      registerParticipant({
        venueCode: "VENUE",
        nickname: "Alice",
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);

    expect(Object.keys(state.participants)).toEqual(["participant-1"]);
    expect(
      Object.values(state.participantSessions).map((session) => ({
        participantId: session.participant_id,
        isActive: session.is_active,
        invalidatedAt: session.invalidated_at,
      })),
    ).toEqual([
      {
        participantId: "participant-1",
        isActive: true,
        invalidatedAt: null,
      },
    ]);
    expect(Object.keys(state.matches)).toHaveLength(0);
    expect(Object.keys(state.tables)).toHaveLength(0);
    expect(state.chipLedger).toHaveLength(0);
  });

  it("rejects an old token after session replacement and restores only the active session", async () => {
    const { participant, sessionToken } = await registerParticipant({
      venueCode: "VENUE",
      nickname: "Alice",
    });

    const replacementToken = "replacement-session-token";
    await replaceParticipantSession({
      state,
      participantId: participant.id,
      rawToken: replacementToken,
    });

    await expect(verifyParticipantSession(sessionToken)).rejects.toMatchObject({
      code: "participant_session_invalid",
      status: 401,
    });

    const runtime = await restoreParticipantSession({
      sessionToken: replacementToken,
    });

    expect(runtime.restoredConnection).toBe(false);
    expect(runtime.runtimeState.participantId).toBe(participant.id);
    expect(runtime.runtimeState.status).toBe("registered");
    expect(runtime.runtimeState.currentMatchId).toBeNull();
    expect(runtime.runtimeState.match).toBeNull();
    expect(runtime.runtimeState.table).toBeNull();
    expect(runtime.runtimeState.canStartMatching).toBe(true);
    expect(runtime.runtimeState.canClaimWin).toBe(false);
    expect(normalizeParticipantConnectionState).toHaveBeenCalledWith({
      participantId: participant.id,
      now: expect.any(Date),
    });
    expect(restoreDisconnectedParticipantIfNeeded).toHaveBeenCalledWith({
      participantId: participant.id,
    });

    const sessions = Object.values(state.participantSessions).sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    expect(sessions).toHaveLength(2);
    expect(sessions.map((session) => session.is_active)).toEqual([false, true]);
    expect(sessions[0]?.invalidated_at).not.toBeNull();
    expect(sessions[1]?.invalidated_at).toBeNull();
    expect(
      sessions.filter((session) => session.participant_id === participant.id && session.is_active),
    ).toHaveLength(1);
    expect(state.participants[participant.id]).toMatchObject({
      status: "registered",
      current_match_id: null,
      chip_balance: 1000,
    });
    expect(Object.keys(state.matches)).toHaveLength(0);
    expect(Object.keys(state.tables)).toHaveLength(0);
    expect(state.chipLedger).toHaveLength(0);
  });
});
