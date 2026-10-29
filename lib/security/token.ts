import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/server/env";
import type { VerifyAction } from "@/lib/types";

export const TOKEN_TTL_SECONDS = 300;

interface Payload {
  lid: string; // 편지 ID
  act: VerifyAction;
  exp: number; // epoch seconds
}

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function sign(body: string): string {
  return createHmac("sha256", requireEnv("LETTER_AUTH_SECRET")).update(body).digest("base64url");
}

/** 특정 편지의 특정 작업(수정/삭제)에만 쓸 수 있는 짧은 수명의 토큰을 만든다. */
export function issueToken(letterId: string, action: VerifyAction): string {
  const payload: Payload = {
    lid: letterId,
    act: action,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function checkToken(token: string | null, letterId: string, action: VerifyAction): boolean {
  if (!token) return false;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return false;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    return (
      payload.lid === letterId &&
      payload.act === action &&
      typeof payload.exp === "number" &&
      payload.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}
