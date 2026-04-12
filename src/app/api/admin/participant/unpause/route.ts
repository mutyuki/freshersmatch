import { errorJson, okJson } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { AppError } from "@/lib/domain/errors";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { unpauseParticipant } from "@/lib/services/admin-participant-service";
import { adminUnpauseParticipantSchema } from "@/lib/validators/admin";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = adminUnpauseParticipantSchema.parse(await request.json());

    if (!input.confirm) {
      throw new AppError(
        "admin_confirmation_required",
        "Confirmation is required for admin participant actions.",
        400,
      );
    }

    const { adminUserId } = await requireAdminSession();
    const result = await unpauseParticipant({
      adminUserId,
      participantId: input.participantId,
    });

    await publishInvalidation({
      eventId: result.eventId,
      scopes: ["participant", "admin"],
      participantIds: [result.participantId],
    });

    return okJson({ ok: true });
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
