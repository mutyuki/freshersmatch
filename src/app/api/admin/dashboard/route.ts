import { errorJson, okJson } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { getActiveEventId, getAdminDashboardData } from "@/lib/services/admin-dashboard-service";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId") ?? (await getActiveEventId());
    const result = await getAdminDashboardData(eventId);

    return okJson(result);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
