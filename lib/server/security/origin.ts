import { getServerEnv } from "../env";
import { HttpError } from "../http";

export function assertTrustedOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const expected = new URL(getServerEnv().APP_ORIGIN).origin;
  if (!origin || origin !== expected) {
    throw new HttpError(403, "INVALID_ORIGIN", "Request origin is not allowed.");
  }
}
