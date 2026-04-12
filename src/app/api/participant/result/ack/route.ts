import { getParticipantBearerSessionToken } from "@/lib/api/participant-auth";
import { errorJson, okJson } from "@/lib/api/response";
import { verifyParticipantSession } from "@/lib/auth/participant-session";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { acknowledgeResultConfirmed } from "@/lib/services/match-service";

export async function POST(request: Request): Promise<Response> {
  try {
    const sessionToken = getParticipantBearerSessionToken(request);
    const { participantId } = await verifyParticipantSession(sessionToken);
    const runtime = await acknowledgeResultConfirmed({
      participantId,
    });

    await publishInvalidation({
      eventId: runtime.eventId,
      scopes: ["participant", "admin", "ranking"],
      participantIds: [participantId],
    });

    return okJson(runtime);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
