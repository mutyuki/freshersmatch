import { ZodError } from "zod";

import { AppError } from "@/lib/domain/errors";

export function okJson<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, init);
}

export function errorJson(error: AppError | Error): Response {
  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      {
        status: error.status,
      },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "invalid_request",
          message: "Request validation failed.",
        },
      },
      {
        status: 400,
      },
    );
  }

  if (error instanceof SyntaxError) {
    return Response.json(
      {
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON.",
        },
      },
      {
        status: 400,
      },
    );
  }

  return Response.json(
    {
      error: {
        code: "internal_server_error",
        message: "An unexpected error occurred.",
      },
    },
    {
      status: 500,
    },
  );
}
