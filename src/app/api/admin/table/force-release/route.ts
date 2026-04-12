import { errorJson, okJson } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { AppError } from "@/lib/domain/errors";
import type { RealtimeScope } from "@/lib/realtime/channels";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { forceReleaseTable } from "@/lib/services/admin-match-service";
import { adminForceReleaseTableSchema } from "@/lib/validators/admin";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = adminForceReleaseTableSchema.parse(await request.json());

    if (!input.confirm) {
      throw new AppError(
        "admin_confirmation_required",
        "Confirmation is required for admin table actions.",
        400,
      );
    }

    const { adminUserId } = await requireAdminSession();
    const result = await forceReleaseTable({
      adminUserId,
      tableId: input.tableId,
    });

    const scopes: RealtimeScope[] =
      result.participantIds.length > 0 || result.matchId
        ? ["participant", "match", "admin"]
        : ["admin"];

    await publishInvalidation({
      eventId: result.eventId,
      scopes,
      participantIds: result.participantIds,
      matchId: result.matchId,
      tableId: result.tableId,
    });

    return okJson({ ok: true });
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
