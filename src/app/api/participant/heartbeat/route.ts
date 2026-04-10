import { errorJson, okJson } from "@/lib/api/response";
import { AppError } from "@/lib/domain/errors";
import { heartbeatParticipant } from "@/lib/services/participant-service";
import { participantHeartbeatSchema } from "@/lib/validators/participant";

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

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    participantHeartbeatSchema.parse(body);

    const sessionToken = getBearerSessionToken(request);
    await heartbeatParticipant({ sessionToken });

    return okJson({ ok: true });
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
