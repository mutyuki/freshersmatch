import { errorJson, okJson } from "@/lib/api/response";
import { getParticipantBearerSessionToken } from "@/lib/api/participant-auth";
import { touchParticipantSession, verifyParticipantSession } from "@/lib/auth/participant-session";
import { getParticipantRuntimeState } from "@/lib/services/participant-service";

export async function GET(request: Request): Promise<Response> {
  try {
    const sessionToken = getParticipantBearerSessionToken(request);
    const { participantId, sessionId } = await verifyParticipantSession(sessionToken);
    await touchParticipantSession(sessionId);
    const result = await getParticipantRuntimeState(participantId);

    return okJson(result);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
