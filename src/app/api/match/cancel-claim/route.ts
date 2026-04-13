import { getParticipantBearerSessionToken } from "@/lib/api/participant-auth";
import { errorJson, okJson } from "@/lib/api/response";
import { verifyParticipantSession } from "@/lib/auth/participant-session";
import { AppError } from "@/lib/domain/errors";
import { publishInvalidation } from "@/lib/realtime/publisher";
import { executeCancelClaimWin } from "@/lib/services/match-service";
import { cancelClaimMatchWinSchema } from "@/lib/validators/match";

export async function POST(request: Request): Promise<Response> {
  let participantId: string | null = null;
  let matchId: string | null = null;

  try {
    const body = await request.json();
    const input = cancelClaimMatchWinSchema.parse(body);
    matchId = input.matchId;
    const sessionToken = getParticipantBearerSessionToken(request);
    const session = await verifyParticipantSession(sessionToken);
    participantId = session.participantId;
    const runtime = await executeCancelClaimWin({
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
    if (!(error instanceof AppError) || error.status >= 500) {
      console.error("cancel-claim route failed.", {
        participantId,
        matchId,
        error,
      });
    }

    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
