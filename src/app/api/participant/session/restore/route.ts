import { errorJson, okJson } from "@/lib/api/response";
import { restoreParticipantSession } from "@/lib/services/participant-service";
import { restoreParticipantSessionSchema } from "@/lib/validators/participant";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const input = restoreParticipantSessionSchema.parse(body);
    const result = await restoreParticipantSession(input);

    return okJson(result);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
