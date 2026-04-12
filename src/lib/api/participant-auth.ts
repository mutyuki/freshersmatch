import { AppError } from "@/lib/domain/errors";

export function getParticipantBearerSessionToken(request: Request): string {
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
