const origin = process.env.AUNO_APP_ORIGIN;
const token = process.env.AUNO_VERIFIER_TOKEN;
const configuredInterval = Number(process.env.AUNO_VERIFIER_POLL_MS || 30_000);
const intervalMs = Number.isFinite(configuredInterval) ? Math.min(Math.max(configuredInterval, 10_000), 300_000) : 30_000;

if (!origin || !token || token.length < 32) {
  throw new Error("Devnet verifier is missing its internal origin or a valid token.");
}

const endpoint = new URL("/api/internal/verify", origin);

async function verify() {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    console.info(JSON.stringify({ event: "coolify_devnet_verifier_run", status: response.status }));
  } catch (error) {
    console.error(JSON.stringify({
      event: "coolify_devnet_verifier_failure",
      message: error instanceof Error ? error.message : "Verifier request failed.",
    }));
  }
}

while (true) {
  await verify();
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}