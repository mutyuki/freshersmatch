import { errorJson, okJson } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { AppError } from "@/lib/domain/errors";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { disqualifyParticipant } from "@/lib/services/admin-participant-service";
import { adminDisqualifyParticipantSchema } from "@/lib/validators/admin";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = adminDisqualifyParticipantSchema.parse(await request.json());

    if (!input.confirm) {
      throw new AppError(
        "admin_confirmation_required",
        "Confirmation is required for admin participant actions.",
        400,
      );
    }

    const { adminUserId } = await requireAdminSession();
    const result = await disqualifyParticipant({
      adminUserId,
      participantId: input.participantId,
      mode: input.mode,
      reason: input.reason,
    });

    await publishInvalidation({
      eventId: result.eventId,
      scopes: ["participant", "admin"],
      participantIds: [result.participantId],
      matchId: result.affectedMatchId ?? null,
    });

    return okJson({ ok: true });
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
