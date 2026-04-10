import { errorJson, okJson } from "@/lib/api/response";
import { getSupabaseAdminClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { AppError } from "@/lib/domain/errors";
import { listRanking } from "@/lib/services/ranking-service";

type ActiveEventRow = Pick<Database["public"]["Tables"]["events"]["Row"], "id">;

async function getActiveEventId(): Promise<string> {
  const { data, error } = await getSupabaseAdminClient()
    .from("events")
    .select("id")
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new AppError("active_event_lookup_failed", "Failed to load active event.", 500);
  }

  if (!data) {
    throw new AppError("active_event_not_found", "Active event was not found.", 404);
  }

  return (data as ActiveEventRow).id;
}

export async function GET(_request: Request): Promise<Response> {
  try {
    const eventId = await getActiveEventId();
    const entries = await listRanking({ eventId });

    return okJson(entries);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
