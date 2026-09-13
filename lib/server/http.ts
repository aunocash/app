import { randomUUID } from "node:crypto";

import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export function requestIdFrom(request: Request): string {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9._-]{1,100}$/.test(supplied) ? supplied : randomUUID();
}

export function apiSuccess<T>(data: T, requestId: string, status = 200): Response {
  logEvent("info", "request.completed", { requestId, status });
  return Response.json({ data, requestId }, { status, headers: { "x-request-id": requestId } });
}

export function apiError(error: unknown, requestId: string): Response {
  if (error instanceof HttpError) {
    logEvent("warn", "request.rejected", { requestId, status: error.status, code: error.code });
    return Response.json(
      { error: { code: error.code, message: error.message, fields: error.fields }, requestId },
      { status: error.status, headers: { "x-request-id": requestId } },
    );
  }
  if (error instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "body";
      (fields[key] ??= []).push(issue.message);
    }
    logEvent("warn", "request.rejected", { requestId, status: 400, code: "VALIDATION_ERROR" });
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Request validation failed.", fields }, requestId },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  logEvent("error", "request.unhandled", { requestId, error });
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An internal error occurred." }, requestId },
    { status: 500, headers: { "x-request-id": requestId } },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

export function logEvent(
  level: "info" | "warn" | "error",
  event: string,
  details: Record<string, unknown> = {},
): void {
  const redactString = (value: string) =>
    value
      .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[REDACTED]@")
      .replace(/([?&](?:api[_-]?key|token|secret)=)[^&\s]+/gi, "$1[REDACTED]");
  const secretKey = /(?:token|secret|password|private.?key|signed.?payload|signature)/i;
  const safeDetails = Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      if (secretKey.test(key)) return [key, "[REDACTED]"];
      if (value instanceof Error) {
        return [key, { name: value.name, message: redactString(value.message) }];
      }
      return [key, typeof value === "string" ? redactString(value) : value];
    }),
  );
  console[level](JSON.stringify({ level, event, ...safeDetails, timestamp: new Date().toISOString() }));
}
