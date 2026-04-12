import { errorJson, okJson } from "@/lib/api/response";
import { loginAdminWithPasscode } from "@/lib/services/admin-auth-service";
import { adminLoginSchema } from "@/lib/validators/admin";

export async function POST(request: Request): Promise<Response> {
  try {
    const input = adminLoginSchema.parse(await request.json());
    const result = await loginAdminWithPasscode(input);

    return okJson(result);
  } catch (error) {
    return errorJson(error instanceof Error ? error : new Error("Unknown error"));
  }
}
