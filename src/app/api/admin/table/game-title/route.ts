import { errorJson, okJson } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import type { RealtimeScope } from "@/lib/realtime/channels";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { updateTableGameTitle } from "@/lib/services/admin-match-service";
import { adminUpdateTableGameTitleSchema } from "@/lib/validators/admin";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = adminUpdateTableGameTitleSchema.parse(await request.json());
    await requireAdminSession();

    const result = await updateTableGameTitle({
      tableId: input.tableId,
      gameTitle: input.gameTitle,
    });

    const scopes: RealtimeScope[] =
      result.participantIds.length > 0 ? ["participant", "match", "admin"] : ["admin"];

    await publishInvalidation({
      eventId: result.eventId,
      scopes,
      participantIds: result.participantIds.length > 0 ? result.participantIds : undefined,
      matchId: result.matchId,
      tableId: result.tableId,
    });

    return okJson({ ok: true });
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
