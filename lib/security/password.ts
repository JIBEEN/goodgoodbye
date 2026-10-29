import "server-only";
import { createHmac } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { requireEnv } from "@/lib/server/env";

// 4자리 숫자는 경우의 수가 1만 개뿐이므로, 서버 비밀값(pepper)으로 먼저 HMAC한 뒤
// Argon2id로 해시한다. DB만 유출돼도 pepper 없이는 오프라인 대입이 불가능하다.
function peppered(password: string): string {
  return createHmac("sha256", requireEnv("LETTER_PASSWORD_PEPPER")).update(password).digest("base64");
}

const ARGON_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(peppered(password), ARGON_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, peppered(password));
  } catch {
    return false;
  }
}
