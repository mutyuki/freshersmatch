import { describe, expect, it } from "vitest";

import { DomainConflictError } from "@/lib/domain/errors";
import type { MatchStatus } from "@/lib/domain/match-status";
import type { ParticipantStatus } from "@/lib/domain/participant-status";
import type { TableStatus } from "@/lib/domain/table-status";
import {
  assertMatchTransition,
  assertParticipantTransition,
  assertTableTransition,
} from "@/lib/domain/state-machine";

describe("assertParticipantTransition", () => {
  const allowedTransitions: Array<[ParticipantStatus, ParticipantStatus]> = [
    ["unregistered", "registered"],
    ["registered", "queueing"],
    ["registered", "paused"],
    ["registered", "disqualified"],
    ["registered", "disconnected"],
    ["queueing", "match_reserved"],
    ["queueing", "registered"],
    ["queueing", "paused"],
    ["queueing", "disqualified"],
    ["queueing", "disconnected"],
    ["match_reserved", "ready"],
    ["match_reserved", "playing"],
    ["match_reserved", "registered"],
    ["match_reserved", "paused"],
    ["match_reserved", "disqualified"],
    ["match_reserved", "disconnected"],
    ["ready", "playing"],
    ["ready", "registered"],
    ["ready", "paused"],
    ["ready", "disqualified"],
    ["ready", "disconnected"],
    ["playing", "claiming_win"],
    ["playing", "awaiting_result_approval"],
    ["playing", "result_confirmed"],
    ["playing", "paused"],
    ["playing", "disqualified"],
    ["playing", "disconnected"],
    ["claiming_win", "playing"],
    ["claiming_win", "result_confirmed"],
    ["claiming_win", "paused"],
    ["claiming_win", "disqualified"],
    ["awaiting_result_approval", "playing"],
    ["awaiting_result_approval", "result_confirmed"],
    ["awaiting_result_approval", "paused"],
    ["awaiting_result_approval", "disqualified"],
    ["result_confirmed", "registered"],
    ["result_confirmed", "paused"],
    ["result_confirmed", "disqualified"],
    ["paused", "registered"],
    ["paused", "disqualified"],
    ["disconnected", "registered"],
    ["disconnected", "queueing"],
    ["disconnected", "match_reserved"],
    ["disconnected", "ready"],
    ["disconnected", "playing"],
  ];

  it.each(allowedTransitions)("allows %s -> %s", (current, next) => {
    expect(() => assertParticipantTransition(current, next)).not.toThrow();
  });

  it("rejects self transitions", () => {
    expect(() => assertParticipantTransition("playing", "playing")).toThrow(DomainConflictError);
  });

  it("rejects reverse transitions that are not in the state machine", () => {
    expect(() => assertParticipantTransition("registered", "unregistered")).toThrow(
      DomainConflictError,
    );
    expect(() => assertParticipantTransition("playing", "ready")).toThrow(DomainConflictError);
    expect(() => assertParticipantTransition("registered", "match_reserved")).toThrow(
      DomainConflictError,
    );
  });

  it("rejects transitions out of terminal states", () => {
    expect(() => assertParticipantTransition("disqualified", "registered")).toThrow(
      DomainConflictError,
    );
  });

  it("rejects disconnected recovery to non-progress states", () => {
    expect(() => assertParticipantTransition("disconnected", "unregistered")).toThrow(
      DomainConflictError,
    );
    expect(() => assertParticipantTransition("disconnected", "paused")).toThrow(
      DomainConflictError,
    );
    expect(() => assertParticipantTransition("disconnected", "result_confirmed")).toThrow(
      DomainConflictError,
    );
  });

  it("rejects disconnecting from states that are not allowed to disconnect", () => {
    expect(() => assertParticipantTransition("claiming_win", "disconnected")).toThrow(
      DomainConflictError,
    );
    expect(() => assertParticipantTransition("awaiting_result_approval", "disconnected")).toThrow(
      DomainConflictError,
    );
    expect(() => assertParticipantTransition("result_confirmed", "disconnected")).toThrow(
      DomainConflictError,
    );
  });
});

describe("assertTableTransition", () => {
  const allowedTransitions: Array<[TableStatus, TableStatus]> = [
    ["available", "reserved"],
    ["available", "admin_hold"],
    ["reserved", "in_use"],
    ["reserved", "available"],
    ["in_use", "available"],
    ["admin_hold", "available"],
  ];

  it.each(allowedTransitions)("allows %s -> %s", (current, next) => {
    expect(() => assertTableTransition(current, next)).not.toThrow();
  });

  it("rejects self transitions", () => {
    expect(() => assertTableTransition("available", "available")).toThrow(DomainConflictError);
  });

  it("rejects reverse or skipped transitions that are not allowed", () => {
    expect(() => assertTableTransition("reserved", "admin_hold")).toThrow(DomainConflictError);
    expect(() => assertTableTransition("in_use", "reserved")).toThrow(DomainConflictError);
    expect(() => assertTableTransition("admin_hold", "reserved")).toThrow(DomainConflictError);
  });
});

describe("assertMatchTransition", () => {
  const allowedTransitions: Array<[MatchStatus, MatchStatus]> = [
    ["reserved", "awaiting_ready"],
    ["reserved", "in_progress"],
    ["reserved", "cancelled_before_start"],
    ["reserved", "voided_by_admin"],
    ["awaiting_ready", "in_progress"],
    ["awaiting_ready", "cancelled_before_start"],
    ["awaiting_ready", "voided_by_admin"],
    ["in_progress", "winner_claimed"],
    ["in_progress", "voided_by_admin"],
    ["in_progress", "force_finished_by_admin"],
    ["winner_claimed", "in_progress"],
    ["winner_claimed", "completed"],
    ["winner_claimed", "voided_by_admin"],
    ["winner_claimed", "force_finished_by_admin"],
  ];

  it.each(allowedTransitions)("allows %s -> %s", (current, next) => {
    expect(() => assertMatchTransition(current, next)).not.toThrow();
  });

  it("rejects self transitions", () => {
    expect(() => assertMatchTransition("in_progress", "in_progress")).toThrow(DomainConflictError);
  });

  it("rejects reverse or skipped transitions that are not allowed", () => {
    expect(() => assertMatchTransition("awaiting_ready", "reserved")).toThrow(DomainConflictError);
    expect(() => assertMatchTransition("reserved", "completed")).toThrow(DomainConflictError);
    expect(() => assertMatchTransition("in_progress", "completed")).toThrow(DomainConflictError);
  });

  it("rejects transitions out of terminal states", () => {
    expect(() => assertMatchTransition("completed", "in_progress")).toThrow(DomainConflictError);
    expect(() => assertMatchTransition("cancelled_before_start", "reserved")).toThrow(
      DomainConflictError,
    );
    expect(() => assertMatchTransition("voided_by_admin", "in_progress")).toThrow(
      DomainConflictError,
    );
    expect(() => assertMatchTransition("force_finished_by_admin", "completed")).toThrow(
      DomainConflictError,
    );
  });
});
