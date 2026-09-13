import { pool } from "./db/client";
import { HttpError } from "./http";

export async function enforceRateLimit(options: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<void> {
  const result = await pool.query<{ count: number }>(
    `INSERT INTO rate_limit_buckets (bucket_key, window_start, count, expires_at, created_at, updated_at)
     VALUES ($1, to_timestamp(floor(extract(epoch FROM now()) / $2) * $2), 1,
       to_timestamp((floor(extract(epoch FROM now()) / $2) + 1) * $2), now(), now())
     ON CONFLICT (bucket_key, window_start) DO UPDATE
       SET count = rate_limit_buckets.count + 1, updated_at = now()
       WHERE rate_limit_buckets.count < $3
     RETURNING count`,
    [options.key, options.windowSeconds, options.limit],
  );
  if (result.rowCount === 0) {
    throw new HttpError(429, "RATE_LIMITED", "Too many requests. Try again later.");
  }
}

export function clientAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
