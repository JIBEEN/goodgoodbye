import { z } from "zod";

export const NICKNAME_MAX = 20;
export const CONTENT_MAX = 2000;

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ko", { granularity: "grapheme" })
    : null;

/** 화면에 보이는 글자(grapheme) 기준 글자 수. 프론트와 서버가 같은 함수를 쓴다. */
export function graphemeLength(value: string): number {
  if (!segmenter) return Array.from(value).length;
  let count = 0;
  for (const _ of segmenter.segment(value)) count++;
  return count;
}

// NUL 등 DB가 거부하거나 화면에서 보이지 않는 제어문자를 제거하고 줄바꿈을 통일한다.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const INVISIBLE = /[\s​-‍⁠﻿]/g;

export function cleanText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "");
}

const isBlank = (value: string) => value.replace(INVISIBLE, "") === "";

export const nicknameSchema = z
  .string({ error: "닉네임을 입력해 주세요." })
  .transform((v) => cleanText(v).replace(/\s+/g, " ").trim())
  .refine((v) => !isBlank(v), { error: "닉네임을 입력해 주세요." })
  .refine((v) => graphemeLength(v) <= NICKNAME_MAX, {
    error: `닉네임은 ${NICKNAME_MAX}자까지 쓸 수 있어요.`,
  });

export const contentSchema = z
  .string({ error: "편지 내용을 입력해 주세요." })
  .transform((v) => cleanText(v).trim())
  .refine((v) => !isBlank(v), { error: "편지 내용을 입력해 주세요." })
  .refine((v) => graphemeLength(v) <= CONTENT_MAX, {
    error: `편지는 ${CONTENT_MAX.toLocaleString("ko-KR")}자까지 쓸 수 있어요.`,
  });

export const passwordSchema = z
  .string({ error: "비밀번호를 입력해 주세요." })
  .regex(/^[0-9]{4}$/, { error: "비밀번호는 숫자 4자리로 입력해 주세요." });

export const slotSchema = z
  .number({ error: "봉투 번호가 올바르지 않아요." })
  .int({ error: "봉투 번호가 올바르지 않아요." })
  .min(1, { error: "봉투 번호가 올바르지 않아요." })
  .max(5, { error: "봉투 번호가 올바르지 않아요." });

export const createLetterSchema = z.object({
  slot_number: slotSchema,
  nickname: nicknameSchema,
  content: contentSchema,
  password: passwordSchema,
});

export const updateLetterSchema = z.object({
  nickname: nicknameSchema,
  content: contentSchema,
  updated_at: z.string({ error: "수정 기준 시각이 필요해요." }).min(1).max(64),
});

export const verifySchema = z.object({
  password: passwordSchema,
  action: z.enum(["edit", "delete"], { error: "요청이 올바르지 않아요." }),
});

export type FieldErrors = Partial<Record<"nickname" | "content" | "password", string>>;

/** 입력 폼용: 필드별 첫 번째 오류 메시지를 돌려준다. */
export function validateLetterFields(
  input: { nickname: string; content: string; password?: string },
  requirePassword: boolean,
): { ok: true; value: { nickname: string; content: string; password: string } } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const nickname = nicknameSchema.safeParse(input.nickname);
  const content = contentSchema.safeParse(input.content);
  const password = requirePassword ? passwordSchema.safeParse(input.password ?? "") : null;
  if (!nickname.success) errors.nickname = nickname.error.issues[0]?.message;
  if (!content.success) errors.content = content.error.issues[0]?.message;
  if (password && !password.success) errors.password = password.error.issues[0]?.message;
  if (nickname.success && content.success && (!password || password.success)) {
    return {
      ok: true,
      value: { nickname: nickname.data, content: content.data, password: password?.success ? password.data : "" },
    };
  }
  return { ok: false, errors };
}
