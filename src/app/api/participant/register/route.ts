import { errorJson, okJson } from "@/lib/api/response";
import { registerParticipant } from "@/lib/services/participant-service";
import { registerParticipantSchema } from "@/lib/validators/participant";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const input = registerParticipantSchema.parse(body);
    const result = await registerParticipant(input);

    return okJson(result);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
