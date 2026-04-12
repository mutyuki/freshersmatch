import { errorJson, okJson } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { getActiveEventId } from "@/lib/services/admin-dashboard-service";
import { listAdminParticipants } from "@/lib/services/admin-participant-service";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId") ?? (await getActiveEventId());
    const result = await listAdminParticipants(eventId);

    return okJson(result);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
