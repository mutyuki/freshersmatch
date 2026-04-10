import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { getRequiredEnv } from "@/lib/db/env";
import { AppError } from "@/lib/domain/errors";

const ADMIN_SESSION_COOKIE_NAME = "freshers_match_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
const ADMIN_SESSION_TTL_MS = ADMIN_SESSION_TTL_SECONDS * 1000;

type AdminSessionPayload = {
  adminUserId: string;
  expiresAt: number;
};

function isAdminSessionPayload(payload: unknown): payload is AdminSessionPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    typeof candidate.adminUserId === "string" &&
    candidate.adminUserId.length > 0 &&
    typeof candidate.expiresAt === "number" &&
    Number.isFinite(candidate.expiresAt)
  );
}

function getAdminSessionSecret(): string {
  return getRequiredEnv("ADMIN_SESSION_SECRET");
}

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

function createAdminSessionSignature(payloadBase64: string): string {
  return createHmac("sha256", getAdminSessionSecret()).update(payloadBase64).digest("base64url");
}

function encodeAdminSessionValue(payload: AdminSessionPayload): string {
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createAdminSessionSignature(payloadBase64);

  return `${payloadBase64}.${signature}`;
}

function decodeAdminSessionValue(rawCookieValue: string): AdminSessionPayload {
  const [payloadBase64, signature, ...rest] = rawCookieValue.split(".");

  if (!payloadBase64 || !signature || rest.length > 0) {
    throw new AppError("admin_session_invalid", "Admin session is invalid.", 401);
  }

  const expectedSignature = createAdminSessionSignature(payloadBase64);

  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    throw new AppError("admin_session_invalid", "Admin session is invalid.", 401);
  }

  let payload: unknown;

  try {
    payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
  } catch {
    throw new AppError("admin_session_invalid", "Admin session is invalid.", 401);
  }

  if (!isAdminSessionPayload(payload)) {
    throw new AppError("admin_session_invalid", "Admin session is invalid.", 401);
  }

  if (payload.expiresAt <= Date.now()) {
    throw new AppError("admin_session_expired", "Admin session has expired.", 401);
  }

  return payload;
}

export async function createAdminSession(adminUserId: string): Promise<void> {
  const expires = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
  const cookieStore = await cookies();

  cookieStore.set(
    ADMIN_SESSION_COOKIE_NAME,
    encodeAdminSessionValue({
      adminUserId,
      expiresAt: expires.getTime(),
    }),
    getAdminSessionCookieOptions(expires),
  );
}

export async function requireAdminSession(): Promise<{ adminUserId: string }> {
  const cookieStore = await cookies();
  const rawCookieValue = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  if (!rawCookieValue) {
    throw new AppError("admin_session_missing", "Admin session is required.", 401);
  }

  const payload = decodeAdminSessionValue(rawCookieValue);

  return {
    adminUserId: payload.adminUserId,
  };
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}
