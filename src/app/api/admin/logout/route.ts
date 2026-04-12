import { errorJson, okJson } from "@/lib/api/response";
import { logoutAdmin } from "@/lib/services/admin-auth-service";

export async function POST(): Promise<Response> {
  try {
    await logoutAdmin();
    return okJson({ ok: true });
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
