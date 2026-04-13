import { getParticipantBearerSessionToken } from "@/lib/api/participant-auth";
import { errorJson, okJson } from "@/lib/api/response";
import { verifyParticipantSession } from "@/lib/auth/participant-session";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { executeStartQueue } from "@/lib/services/matching-service";

export async function POST(request: Request): Promise<Response> {
  try {
    const sessionToken = getParticipantBearerSessionToken(request);
    const { participantId } = await verifyParticipantSession(sessionToken);
    const runtime = await executeStartQueue({ participantId });
    const participantIds = runtime.opponent
      ? [runtime.participantId, runtime.opponent.participantId]
      : [runtime.participantId];
    const scopes = runtime.currentMatchId
      ? ["participant", "match", "admin"]
      : ["participant", "admin"];

    await publishInvalidation({
      eventId: runtime.eventId,
      scopes,
      participantIds,
      matchId: runtime.currentMatchId,
      tableId: runtime.table?.id ?? null,
    });

    return okJson(runtime);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
