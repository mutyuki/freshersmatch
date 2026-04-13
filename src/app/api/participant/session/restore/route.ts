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

    if (result.restoredConnection) {
      const scopes: RealtimeScope[] = result.runtimeState.currentMatchId
        ? ["participant", "match", "admin"]
        : ["participant", "admin"];

      void publishInvalidation({
        eventId: result.runtimeState.eventId,
        scopes,
        participantIds: [result.runtimeState.participantId],
        matchId: result.runtimeState.currentMatchId,
        tableId: result.runtimeState.table?.id ?? null,
      });
    }

    return okJson(result.runtimeState);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
