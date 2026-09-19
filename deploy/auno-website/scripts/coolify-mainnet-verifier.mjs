const origin = process.env.AUNO_APP_ORIGIN;
const token = process.env.AUNO_VERIFIER_TOKEN;
const mode = process.env.AUNO_COOLIFY_MAINNET_PRODUCTION === "true" ? "production" : "staging";
const configuredInterval = Number(process.env.AUNO_VERIFIER_POLL_MS);
const intervalMs = Number.isFinite(configuredInterval) && configuredInterval >= 15_000 ? configuredInterval : 120_000;

if (!origin || !token) {
  throw new Error("Mainnet verifier is missing its internal origin or token.");
}

const endpoint = new URL("/api/internal/verify", origin);

async function verify() {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    console.info(JSON.stringify({ event: `coolify_mainnet_${mode}_verifier_run`, status: response.status }));
  } catch (error) {
    console.error(JSON.stringify({
      event: `coolify_mainnet_${mode}_verifier_failure`,
      message: error instanceof Error ? error.message : "Verifier request failed.",
    }));
  }
}

async function run() {
  while (true) {
    await verify();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

await run();
