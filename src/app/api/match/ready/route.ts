import { getParticipantBearerSessionToken } from "@/lib/api/participant-auth";
import { errorJson, okJson } from "@/lib/api/response";
import { verifyParticipantSession } from "@/lib/auth/participant-session";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { executeReadyMatch } from "@/lib/services/match-service";
import { readyMatchSchema } from "@/lib/validators/match";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const input = readyMatchSchema.parse(body);
    const sessionToken = getParticipantBearerSessionToken(request);
    const { participantId } = await verifyParticipantSession(sessionToken);
    const runtime = await executeReadyMatch({
      participantId,
      matchId: input.matchId,
    });

    await publishInvalidation({
      eventId: runtime.eventId,
      scopes: ["participant", "match", "admin"],
      participantIds: [participantId],
      matchId: input.matchId,
    });

    return okJson(runtime);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
