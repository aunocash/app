import { handled, publicCapabilities } from "@/lib/payments/server";

export async function GET() {
  return handled(async () => publicCapabilities());
}
