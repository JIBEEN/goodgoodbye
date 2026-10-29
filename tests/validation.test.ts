import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createLetterSchema,
  graphemeLength,
  passwordSchema,
  validateLetterFields,
} from "../lib/validation/letter.ts";

const valid = { slot_number: 1, nickname: "민수", content: "감사합니다", password: "1234" };

test("글자 수는 화면에 보이는 글자 기준", () => {
  assert.equal(graphemeLength("가나다"), 3);
  assert.equal(graphemeLength("👨‍👩‍👧‍👦"), 1);
  assert.equal(graphemeLength("🇰🇷"), 1);
});

test("정상 입력은 통과하고 앞뒤 공백이 제거된다", () => {
  const r = createLetterSchema.parse({ ...valid, nickname: "  민수  ", content: "\n  안녕하세요  \n" });
  assert.equal(r.nickname, "민수");
  assert.equal(r.content, "안녕하세요");
});

test("빈 값·공백만 있는 값·보이지 않는 문자만 있는 값은 거절", () => {
  for (const bad of ["", "   ", "\n\t", "​​", "　", "﻿"]) {
    assert.equal(createLetterSchema.safeParse({ ...valid, nickname: bad }).success, false, JSON.stringify(bad));
    assert.equal(createLetterSchema.safeParse({ ...valid, content: bad }).success, false, JSON.stringify(bad));
  }
});

test("글자 수 한도: 닉네임 20자, 본문 2000자", () => {
  assert.equal(createLetterSchema.safeParse({ ...valid, nickname: "가".repeat(20) }).success, true);
  assert.equal(createLetterSchema.safeParse({ ...valid, nickname: "가".repeat(21) }).success, false);
  assert.equal(createLetterSchema.safeParse({ ...valid, content: "가".repeat(2000) }).success, true);
  assert.equal(createLetterSchema.safeParse({ ...valid, content: "가".repeat(2001) }).success, false);
  // 이모지 한 글자는 코드포인트가 여러 개여도 1자로 센다
  assert.equal(createLetterSchema.safeParse({ ...valid, nickname: "👨‍👩‍👧‍👦".repeat(20) }).success, true);
});

test("NUL 등 제어문자는 제거된다", () => {
  const r = createLetterSchema.parse({ ...valid, content: "안\u0000녕\u0007" });
  assert.equal(r.content, "안녕");
});

test("비밀번호는 숫자 4자리만", () => {
  for (const ok of ["0000", "1234"]) assert.equal(passwordSchema.safeParse(ok).success, true);
  for (const bad of ["123", "12345", "abcd", "12 4", "１２３４", "", "12.4"]) {
    assert.equal(passwordSchema.safeParse(bad).success, false, bad);
  }
});

test("봉투 번호는 1~5 정수", () => {
  for (const bad of [0, 6, 1.5, -1, "1" as unknown as number]) {
    assert.equal(createLetterSchema.safeParse({ ...valid, slot_number: bad }).success, false, String(bad));
  }
});

test("폼 검증은 필드별 오류를 돌려준다", () => {
  const r = validateLetterFields({ nickname: "", content: "", password: "12" }, true);
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(Object.keys(r.errors).sort(), ["content", "nickname", "password"]);
  assert.equal(validateLetterFields({ nickname: "a", content: "b" }, false).ok, true);
});
