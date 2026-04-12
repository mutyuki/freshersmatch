import { errorJson, okJson } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { AppError } from "@/lib/domain/errors";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { startStaffMatch } from "@/lib/services/staff-match-service";
import { adminStartStaffMatchSchema } from "@/lib/validators/admin";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = adminStartStaffMatchSchema.parse(await request.json());

    if (!input.confirm) {
      throw new AppError(
        "admin_confirmation_required",
        "Confirmation is required for admin staff match actions.",
        400,
      );
    }

    const { adminUserId } = await requireAdminSession();
    const result = await startStaffMatch({
      adminUserId,
      participantId: input.participantId,
      optionalTableId: input.tableId,
    });

    await publishInvalidation({
      eventId: result.eventId,
      scopes: ["participant", "match", "admin"],
      participantIds: result.participantIds,
      matchId: result.matchId,
      tableId: result.tableId,
    });

    return okJson({ ok: true, matchId: result.matchId });
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
