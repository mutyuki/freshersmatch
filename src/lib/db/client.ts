"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getRequiredEnv } from "@/lib/db/env";
import type { Database } from "@/lib/db/types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  browserClient = createBrowserClient<Database>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );

  return browserClient;
}
