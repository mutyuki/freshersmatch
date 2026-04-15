import { errorJson, okJson } from "@/lib/api/response";
import { getParticipantBearerSessionToken } from "@/lib/api/participant-auth";
import { touchParticipantSession, verifyParticipantSession } from "@/lib/auth/participant-session";
import {
  getParticipantRuleByTableId,
  listParticipantGameRules,
} from "@/lib/services/participant-service";

export async function GET(request: Request): Promise<Response> {
  try {
    const sessionToken = getParticipantBearerSessionToken(request);
    const { participantId, sessionId } = await verifyParticipantSession(sessionToken);
    await touchParticipantSession(sessionId);

    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId");

    if (tableId) {
      return okJson(await getParticipantRuleByTableId(participantId, tableId));
    }

    return okJson(await listParticipantGameRules(participantId));
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
