import { apiSuccess, requestIdFrom } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  return apiSuccess({ status: "live" }, requestIdFrom(request));
}
