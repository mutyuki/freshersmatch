import { errorJson, okJson } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { AppError } from "@/lib/domain/errors";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { resolveMatchByAdmin } from "@/lib/services/admin-match-service";
import { adminResolveMatchSchema } from "@/lib/validators/admin";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = adminResolveMatchSchema.parse(await request.json());

    if (!input.confirm) {
      throw new AppError(
        "admin_confirmation_required",
        "Confirmation is required for admin match actions.",
        400,
      );
    }

    const { adminUserId } = await requireAdminSession();
    const result = await resolveMatchByAdmin({
      adminUserId,
      matchId: input.matchId,
      resolution:
        input.resolutionType === "winner"
          ? {
              type: "winner",
              winnerParticipantId: input.winnerParticipantId,
            }
          : {
              type: "void",
            },
    });

    await publishInvalidation({
      eventId: result.eventId,
      scopes: result.includeRanking
        ? ["participant", "match", "admin", "ranking"]
        : ["participant", "match", "admin"],
      participantIds: result.participantIds,
      matchId: result.matchId,
      tableId: result.tableId,
    });

    return okJson({ ok: true });
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
