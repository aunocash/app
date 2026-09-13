import { randomBytes, randomUUID } from "node:crypto";

import bs58 from "bs58";

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export function createReferenceAddress(): string {
  return bs58.encode(randomBytes(32));
}
