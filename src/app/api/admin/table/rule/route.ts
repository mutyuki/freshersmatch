import { errorJson, okJson } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { AppError } from "@/lib/domain/errors";
import type { RealtimeScope } from "@/lib/realtime/channels";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { getAdminTableRule, updateTableRule } from "@/lib/services/admin-match-service";
import { adminUpdateTableRuleSchema } from "@/lib/validators/admin";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");

    if (!tableId) {
      throw new AppError("table_id_required", "Table id is required.", 400);
    }

    return okJson(await getAdminTableRule(tableId));
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const input = adminUpdateTableRuleSchema.parse(await request.json());
    await requireAdminSession();

    const result = await updateTableRule({
      tableId: input.tableId,
      title: input.title,
      body: input.body,
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
