import { createHash, randomBytes } from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { AppError } from "@/lib/domain/errors";

type ParticipantSessionLookup = Pick<
  Database["public"]["Tables"]["participant_sessions"]["Row"],
  "id" | "participant_id"
>;
type ParticipantSessionTouchResult = Pick<ParticipantSessionLookup, "id">;
type ParticipantSessionUpdate = Pick<
  Database["public"]["Tables"]["participant_sessions"]["Update"],
  "last_seen_at"
>;
type ParticipantSessionSelectQuery = {
  select(columns: "id, participant_id"): {
    eq(
      column: "session_token_hash",
      value: string,
    ): {
      eq(
        column: "is_active",
        value: true,
      ): {
        maybeSingle(): Promise<{
          data: ParticipantSessionLookup | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};
type ParticipantSessionUpdateQuery = {
  update(values: ParticipantSessionUpdate): {
    eq(
      column: "id",
      value: string,
    ): {
      select(columns: "id"): Promise<{
        data: ParticipantSessionTouchResult[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export function generateParticipantSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashParticipantSessionToken(rawToken: string): Promise<string> {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function verifyParticipantSession(
  rawToken: string,
): Promise<{ participantId: string; sessionId: string }> {
  const sessionTokenHash = await hashParticipantSessionToken(rawToken);
  const participantSessions = getSupabaseAdminClient().from(
    "participant_sessions",
  ) as unknown as ParticipantSessionSelectQuery;

  const { data, error } = await participantSessions
    .select("id, participant_id")
    .eq("session_token_hash", sessionTokenHash)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "participant_session_lookup_failed",
      "Failed to look up participant session.",
      401,
    );
  }

  if (!data) {
    throw new AppError("participant_session_invalid", "Participant session is invalid.", 401);
  }

  return {
    participantId: data.participant_id,
    sessionId: data.id,
  };
}

export async function touchParticipantSession(sessionId: string): Promise<void> {
  const participantSessions = getSupabaseAdminClient().from(
    "participant_sessions",
  ) as unknown as ParticipantSessionUpdateQuery;
  const { data, error } = await participantSessions
    .update({
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select("id");

  if (error) {
    throw new AppError(
      "participant_session_touch_failed",
      "Failed to update participant session heartbeat.",
      401,
    );
  }

  if (!data || data.length === 0) {
    throw new AppError("participant_session_not_found", "Participant session was not found.", 401);
  }
}
