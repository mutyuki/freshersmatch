import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { getSupabaseAdminClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { AppError } from "@/lib/domain/errors";

const ADMIN_SESSION_COOKIE_NAME = "freshers_match_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
const ADMIN_SESSION_TTL_MS = ADMIN_SESSION_TTL_SECONDS * 1000;

type AdminSessionLookup = Pick<
  Database["public"]["Tables"]["admin_sessions"]["Row"],
  "id" | "admin_user_id" | "is_active" | "expires_at"
>;
type AdminSessionInsert = Database["public"]["Tables"]["admin_sessions"]["Insert"];
type AdminSessionInvalidateUpdate = Pick<
  Database["public"]["Tables"]["admin_sessions"]["Update"],
  "is_active" | "invalidated_at"
>;
type AdminSessionTouchUpdate = Pick<
  Database["public"]["Tables"]["admin_sessions"]["Update"],
  "last_seen_at"
>;
type AdminSessionInsertQuery = {
  insert(values: AdminSessionInsert): Promise<{
    data: null;
    error: { message: string } | null;
  }>;
};
type AdminSessionSelectQuery = {
  select(columns: "id, admin_user_id, is_active, expires_at"): {
    eq(
      column: "session_token_hash",
      value: string,
    ): {
      maybeSingle(): Promise<{
        data: AdminSessionLookup | null;
        error: { message: string } | null;
      }>;
    };
  };
};
type AdminSessionUpdateQuery = {
  update(values: AdminSessionInvalidateUpdate): {
    eq(
      column: "session_token_hash",
      value: string,
    ): {
      eq(
        column: "is_active",
        value: true,
      ): Promise<{
        data: null;
        error: { message: string } | null;
      }>;
    };
  };
};
type AdminSessionTouchQuery = {
  update(values: AdminSessionTouchUpdate): {
    eq(
      column: "id",
      value: string,
    ): {
      eq(
        column: "is_active",
        value: true,
      ): {
        select(columns: "id"): Promise<{
          data: Array<Pick<Database["public"]["Tables"]["admin_sessions"]["Row"], "id">> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

function getAdminSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  };
}

function getAdminSessionsInsertQuery(): AdminSessionInsertQuery {
  return getSupabaseAdminClient().from("admin_sessions") as unknown as AdminSessionInsertQuery;
}

function getAdminSessionsSelectQuery(): AdminSessionSelectQuery {
  return getSupabaseAdminClient().from("admin_sessions") as unknown as AdminSessionSelectQuery;
}

function getAdminSessionsUpdateQuery(): AdminSessionUpdateQuery {
  return getSupabaseAdminClient().from("admin_sessions") as unknown as AdminSessionUpdateQuery;
}

function getAdminSessionsTouchQuery(): AdminSessionTouchQuery {
  return getSupabaseAdminClient().from("admin_sessions") as unknown as AdminSessionTouchQuery;
}

export function generateAdminSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashAdminSessionToken(rawToken: string): Promise<string> {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function createAdminSession(adminUserId: string): Promise<void> {
  const rawToken = generateAdminSessionToken();
  const sessionTokenHash = await hashAdminSessionToken(rawToken);
  const expires = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
  const cookieStore = await cookies();
  const adminSessions = getAdminSessionsInsertQuery();
  const now = new Date().toISOString();

  const { error } = await adminSessions.insert({
    admin_user_id: adminUserId,
    session_token_hash: sessionTokenHash,
    is_active: true,
    issued_at: now,
    expires_at: expires.toISOString(),
    invalidated_at: null,
    last_seen_at: now,
  });

  if (error) {
    throw new AppError("admin_session_create_failed", "Failed to create admin session.", 401);
  }

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, rawToken, getAdminSessionCookieOptions(expires));
}

export async function requireAdminSession(): Promise<{ adminUserId: string }> {
  const cookieStore = await cookies();
  const rawCookieValue = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  if (!rawCookieValue) {
    throw new AppError("admin_session_missing", "Admin session is required.", 401);
  }

  const sessionTokenHash = await hashAdminSessionToken(rawCookieValue);
  const adminSessions = getAdminSessionsSelectQuery();
  const { data, error } = await adminSessions
    .select("id, admin_user_id, is_active, expires_at")
    .eq("session_token_hash", sessionTokenHash)
    .maybeSingle();

  if (error) {
    throw new AppError("admin_session_lookup_failed", "Failed to look up admin session.", 401);
  }

  if (!data) {
    throw new AppError("admin_session_invalid", "Admin session is invalid.", 401);
  }

  if (!data.is_active) {
    throw new AppError("admin_session_invalid", "Admin session is invalid.", 401);
  }

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    const adminSessionsUpdate = getAdminSessionsUpdateQuery();
    const { error: invalidateError } = await adminSessionsUpdate
      .update({
        is_active: false,
        invalidated_at: new Date().toISOString(),
      })
      .eq("session_token_hash", sessionTokenHash)
      .eq("is_active", true);

    if (invalidateError) {
      throw new AppError("admin_session_lookup_failed", "Failed to look up admin session.", 401);
    }

    throw new AppError("admin_session_expired", "Admin session has expired.", 401);
  }

  const adminSessionsTouch = getAdminSessionsTouchQuery();
  const { data: touchedRows, error: touchError } = await adminSessionsTouch
    .update({
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .eq("is_active", true)
    .select("id");

  if (touchError) {
    throw new AppError("admin_session_lookup_failed", "Failed to look up admin session.", 401);
  }

  if (!touchedRows || touchedRows.length === 0) {
    throw new AppError("admin_session_invalid", "Admin session is invalid.", 401);
  }

  return {
    adminUserId: data.admin_user_id,
  };
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawCookieValue = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  if (rawCookieValue) {
    const sessionTokenHash = await hashAdminSessionToken(rawCookieValue);
    const adminSessions = getAdminSessionsUpdateQuery();
    const { error } = await adminSessions
      .update({
        is_active: false,
        invalidated_at: new Date().toISOString(),
      })
      .eq("session_token_hash", sessionTokenHash)
      .eq("is_active", true);

    if (error) {
      throw new AppError("admin_session_clear_failed", "Failed to clear admin session.", 401);
    }
  }

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}
