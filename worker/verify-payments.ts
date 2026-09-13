import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const [{ getServerEnv }, { logEvent }, { claimVerificationAttempts, processVerificationAttempt }] =
  await Promise.all([
    import("../lib/server/env"),
    import("../lib/server/http"),
    import("../lib/server/verification/worker-service"),
  ]);

const env = getServerEnv();
const workerId = `worker-${randomUUID()}`;
let stopping = false;

process.once("SIGINT", () => {
  stopping = true;
});
process.once("SIGTERM", () => {
  stopping = true;
});

logEvent("info", "verification.worker_started", { workerId });
while (!stopping) {
  try {
    const attempts = await claimVerificationAttempts(workerId, env.WORKER_BATCH_SIZE);
    await Promise.all(attempts.map((attempt) => processVerificationAttempt(attempt, workerId)));
  } catch (error) {
    logEvent("error", "verification.worker_cycle_failed", { workerId, error });
  }
  if (!stopping) await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_MS));
}
logEvent("info", "verification.worker_stopped", { workerId });
