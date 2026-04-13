import { getParticipantBearerSessionToken } from "@/lib/api/participant-auth";
import { errorJson, okJson } from "@/lib/api/response";
import { verifyParticipantSession } from "@/lib/auth/participant-session";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { executeApproveResult } from "@/lib/services/match-service";
import { approveMatchResultSchema } from "@/lib/validators/match";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const input = approveMatchResultSchema.parse(body);
    const sessionToken = getParticipantBearerSessionToken(request);
    const { participantId } = await verifyParticipantSession(sessionToken);
    const runtime = await executeApproveResult({
      participantId,
      matchId: input.matchId,
      approve: input.approve,
    });

    await publishInvalidation({
      eventId: runtime.eventId,
      scopes: input.approve
        ? ["participant", "match", "admin", "ranking"]
        : ["participant", "match", "admin"],
      participantIds: [participantId],
      matchId: input.matchId,
    });

    return okJson(runtime);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
