export function readRuntimeEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env && typeof process.env[name] === "string") {
    return process.env[name];
  }
  const workerEnv = (globalThis as { env?: Record<string, unknown> }).env;
  if (workerEnv && typeof workerEnv[name] === "string") return workerEnv[name] as string;
  return undefined;
}

export function serverMainnetEnabled(): boolean {
  return readRuntimeEnv("AUNO_MAINNET_ENABLED") === "true";
}

export function serverMainnetSplitsEnabled(): boolean {
  return serverMainnetEnabled() && readRuntimeEnv("AUNO_MAINNET_SPLITS_ENABLED") === "true";
}
