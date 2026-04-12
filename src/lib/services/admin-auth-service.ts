import { scryptSync, timingSafeEqual } from "node:crypto";

import { clearAdminSession, createAdminSession } from "@/lib/auth/admin-session";
import { getSupabaseAdminClient } from "@/lib/db/server";
import type { AdminRole, Database } from "@/lib/db/types";
import { AppError } from "@/lib/domain/errors";

type AdminUserRow = Pick<
  Database["public"]["Tables"]["admin_users"]["Row"],
  "id" | "passcode_hash"
>;

type AdminUsersQuery = {
  select(columns: "id, passcode_hash"): {
    eq(
      column: "role",
      value: AdminRole,
    ): Promise<{
      data: AdminUserRow[] | null;
      error: { message: string } | null;
    }>;
  };
};

function getAdminUsersQuery(): AdminUsersQuery {
  return getSupabaseAdminClient().from("admin_users") as unknown as AdminUsersQuery;
}

function derivePasscodeKey(passcode: string, salt: string): Buffer {
  return scryptSync(passcode, salt, 64);
}

function verifyPasscodeHash(passcode: string, storedHash: string): boolean {
  const [salt, derivedKeyHex, ...rest] = storedHash.split(":");

  if (!salt || !derivedKeyHex || rest.length > 0) {
    throw new AppError("admin_passcode_hash_invalid", "Admin passcode hash is misconfigured.", 500);
  }

  const storedKey = Buffer.from(derivedKeyHex, "hex");

  if (storedKey.length === 0 || storedKey.length !== 64) {
    throw new AppError("admin_passcode_hash_invalid", "Admin passcode hash is misconfigured.", 500);
  }

  const computedKey = derivePasscodeKey(passcode, salt);
  return timingSafeEqual(computedKey, storedKey);
}

export async function loginAdminWithPasscode(params: {
  passcode: string;
}): Promise<{ adminUserId: string }> {
  const { passcode } = params;
  const adminUsers = getAdminUsersQuery();
  const { data, error } = await adminUsers.select("id, passcode_hash").eq("role", "admin");

  if (error) {
    throw new AppError("admin_user_lookup_failed", "Failed to load admin user.", 500);
  }

  if (!data || data.length === 0) {
    throw new AppError("admin_user_not_found", "Admin user was not found.", 401);
  }

  for (const adminUser of data) {
    if (!verifyPasscodeHash(passcode, adminUser.passcode_hash)) {
      continue;
    }

    await createAdminSession(adminUser.id);
    return {
      adminUserId: adminUser.id,
    };
  }

  throw new AppError("admin_passcode_invalid", "Admin passcode is invalid.", 401);
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminSession();
}
