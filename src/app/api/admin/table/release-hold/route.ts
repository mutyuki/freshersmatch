import { errorJson, okJson } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { AppError } from "@/lib/domain/errors";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { releaseTableHold } from "@/lib/services/admin-match-service";
import { adminReleaseTableHoldSchema } from "@/lib/validators/admin";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = adminReleaseTableHoldSchema.parse(await request.json());

    if (!input.confirm) {
      throw new AppError(
        "admin_confirmation_required",
        "Confirmation is required for admin table actions.",
        400,
      );
    }

    const { adminUserId } = await requireAdminSession();
    const result = await releaseTableHold({
      adminUserId,
      tableId: input.tableId,
    });

    await publishInvalidation({
      eventId: result.eventId,
      scopes: ["admin"],
      tableId: result.tableId,
    });

    return okJson({ ok: true });
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
