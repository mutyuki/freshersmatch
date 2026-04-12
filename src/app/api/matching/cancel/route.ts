import { getParticipantBearerSessionToken } from "@/lib/api/participant-auth";
import { errorJson, okJson } from "@/lib/api/response";
import { verifyParticipantSession } from "@/lib/auth/participant-session";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { executeCancelQueue } from "@/lib/services/matching-service";

export async function POST(request: Request): Promise<Response> {
  try {
    const sessionToken = getParticipantBearerSessionToken(request);
    const { participantId } = await verifyParticipantSession(sessionToken);
    const runtime = await executeCancelQueue({ participantId });

    await publishInvalidation({
      eventId: runtime.eventId,
      scopes: ["participant", "admin"],
      participantIds: [participantId],
    });

    return okJson(runtime);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
