import { errorJson, okJson } from "@/lib/api/response";
import { verifyParticipantSession } from "@/lib/auth/participant-session";
import { AppError } from "@/lib/domain/errors";
import { getParticipantRuntimeState } from "@/lib/services/participant-service";

function getBearerSessionToken(request: Request): string {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    throw new AppError("participant_session_missing", "Participant session is required.", 401);
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError("participant_session_invalid", "Participant session is invalid.", 401);
  }

  return token;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const sessionToken = getBearerSessionToken(request);
    const { participantId } = await verifyParticipantSession(sessionToken);
    const result = await getParticipantRuntimeState(participantId);

    return okJson(result);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
