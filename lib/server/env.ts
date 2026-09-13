import { z } from "zod";

export const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ORIGIN: z.url(),
  DATABASE_URL: z.string().startsWith("postgres"),
  SOLANA_NETWORK: z.enum(["devnet", "mainnet-beta"]).default("devnet"),
  SOLANA_RPC_URL: z.url(),
  USDC_MINT: z.string().min(32).max(44).optional(),
  ENABLE_MAINNET: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  ENABLE_DEVNET_DEMO: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  DEMO_RECIPIENT_WALLET: z.string().min(32).max(44).optional(),
  WORKER_POLL_MS: z.coerce.number().int().min(250).max(60_000).default(2000),
  WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(604_800),
  SESSION_COOKIE_SECURE: z.enum(["true", "false"]).optional().transform((value) => value === "true"),
});

export type ServerEnv = Omit<z.infer<typeof serverEnvSchema>, "USDC_MINT"> & {
  USDC_MINT: string;
};

export function loadServerEnv(source: Record<string, string | undefined>): ServerEnv {
  for (const name of ["NEXT_PUBLIC_DATABASE_URL", "NEXT_PUBLIC_SOLANA_RPC_URL", "NEXT_PUBLIC_SESSION_SECRET"]) {
    if (source[name]) throw new Error(`${name} must never be exposed to the browser.`);
  }

  const parsed = serverEnvSchema.parse({
    ...source,
    USDC_MINT: source.USDC_MINT || undefined,
  });
  if (parsed.SOLANA_NETWORK === "mainnet-beta") {
    if (!parsed.ENABLE_MAINNET) throw new Error("Mainnet is disabled.");
    if (!parsed.USDC_MINT) throw new Error("Mainnet requires an explicit USDC mint.");
  }
  if (parsed.ENABLE_DEVNET_DEMO && (parsed.SOLANA_NETWORK !== "devnet" || !parsed.DEMO_RECIPIENT_WALLET)) {
    throw new Error("Live devnet demo requires devnet and DEMO_RECIPIENT_WALLET.");
  }
  if (parsed.SOLANA_NETWORK === "devnet" && parsed.USDC_MINT && parsed.USDC_MINT !== DEVNET_USDC_MINT) {
    throw new Error("Devnet USDC mint does not match the canonical Circle mint.");
  }

  return {
    ...parsed,
    USDC_MINT: parsed.SOLANA_NETWORK === "devnet" ? DEVNET_USDC_MINT : parsed.USDC_MINT!,
    SESSION_COOKIE_SECURE: parsed.SESSION_COOKIE_SECURE || parsed.NODE_ENV === "production",
  };
}

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedEnv ??= loadServerEnv(process.env);
  return cachedEnv;
}
