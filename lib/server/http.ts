import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function fail(status: number, code: string, message: string) {
  return json({ error: { code, message } }, status);
}

export const tooMany = () => fail(429, "rate_limited", "잠시 후 다시 시도해 주세요.");

export function serverError(error: unknown) {
  // 비밀번호·본문 등 요청 내용은 로그에 남기지 않는다.
  console.error("[api]", error instanceof Error ? error.message : "unknown error");
  return fail(500, "server_error", "일시적인 오류가 생겼어요. 잠시 후 다시 시도해 주세요.");
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

export function bearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

/** 본문을 JSON으로 읽고 zod로 검사한다. 실패하면 400 응답을 돌려준다. */
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: fail(400, "invalid_json", "요청 형식이 올바르지 않아요.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: fail(400, "invalid_input", parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요."),
    };
  }
  return { ok: true, data: parsed.data };
}
