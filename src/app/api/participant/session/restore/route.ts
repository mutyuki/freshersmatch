import { errorJson, okJson } from "@/lib/api/response";
import type { RealtimeScope } from "@/lib/realtime/channels";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { restoreParticipantSession } from "@/lib/services/participant-service";
import { restoreParticipantSessionSchema } from "@/lib/validators/participant";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const input = restoreParticipantSessionSchema.parse(body);
    const result = await restoreParticipantSession(input);
    const scopes: RealtimeScope[] = result.currentMatchId
      ? ["participant", "match", "admin"]
      : ["participant", "admin"];

    await publishInvalidation({
      eventId: result.eventId,
      scopes,
      participantIds: [result.participantId],
      matchId: result.currentMatchId,
      tableId: result.table?.id ?? null,
    });

    return okJson(result);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
