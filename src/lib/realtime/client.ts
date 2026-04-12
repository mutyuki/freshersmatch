"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export function createRealtimeClient(): SupabaseClient<Database> {
  return getSupabaseBrowserClient();
}
