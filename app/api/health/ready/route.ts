import { pool } from "@/lib/server/db/client";
import { apiError, apiSuccess, requestIdFrom } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request);
  try {
    await pool.query("SELECT 1");
    return apiSuccess({ status: "ready" }, requestId);
  } catch (error) {
    return apiError(error, requestId);
  }
}
