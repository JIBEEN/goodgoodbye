const { chromium, devices } = require("playwright");
const sharp = require("sharp");
const assert = require("node:assert/strict");
const B = "http://127.0.0.1:3100", F = "http://127.0.0.1:54321";
const shot = (p, n) => p.screenshot({ path: `e2e/.out/${n}.png` });
(async () => {
  await fetch(F + "/__reset");
  // 테스트용 "추억 사진": 노을 그라데이션 + 사람 모양 실루엣
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2400"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c9a0"/><stop offset=".6" stop-color="#e58f8a"/><stop offset="1" stop-color="#6c5b7b"/></linearGradient></defs><rect width="1800" height="2400" fill="url(#g)"/><circle cx="900" cy="900" r="260" fill="#3b2f3a"/><rect x="560" y="1160" width="680" height="900" rx="260" fill="#3b2f3a"/></svg>`;
  await sharp(Buffer.from(svg)).jpeg().toFile("e2e/.out/photo.jpg");

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "ko-KR" });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(B + "/edit");
  await page.getByRole("button", { name: "사진 고르기" }).waitFor();
  await shot(page, "01-upload-empty");
  await page.setInputFiles('input[type=file]', "e2e/.out/photo.jpg");
  await page.getByRole("img", { name: "선택한 배경 사진 미리보기" }).waitFor();
  await shot(page, "02-upload-preview");
  await page.getByRole("button", { name: "이 사진으로 등록하기" }).click();
  await shot(page, "03-upload-confirm");
  await page.getByRole("button", { name: "등록하기", exact: true }).click();
  await page.getByRole("group", { name: "편지봉투 5개" }).waitFor();
  console.log("upload → board OK");
  await page.waitForTimeout(600);
  await shot(page, "04-board-empty");

  // 신규 작성
  const envs = page.getByRole("button", { name: /번 봉투/ });
  assert.equal(await envs.count(), 5);
  await page.getByRole("button", { name: "1번 봉투, 아직 비어 있어요" }).click();
  await page.getByRole("dialog", { name: "새 편지 쓰기" }).waitFor();
  await page.waitForTimeout(400);
  await shot(page, "05-compose-empty");
  await page.getByRole("button", { name: "저장하기" }).click();
  await shot(page, "06-compose-errors");
  await page.getByLabel("닉네임").fill("막내 민수");
  await page.getByLabel("편지 내용").fill("팀장님, 그동안 정말 감사했습니다.\n\n처음 입사했을 때 제 서툰 보고서를 끝까지 읽어 주시고 \"괜찮아, 다시 해보자\"라고 말씀해 주셨던 게 아직도 기억에 남아요. ".repeat(6) + "\n<script>alert('x')</script>");
  await page.getByLabel(/비밀번호/).pressSequentially("12ab34");
  assert.equal(await page.getByLabel(/비밀번호/).inputValue(), "1234");
  await shot(page, "07-compose-filled");
  await page.getByRole("button", { name: "저장하기" }).click();
  await page.getByText("편지가 봉투에 담겼어요").waitFor();
  await page.waitForTimeout(700);
  await shot(page, "08-board-one-sealed");
  assert.equal(await page.getByRole("button", { name: "1번 봉투, 막내 민수님의 편지 열기" }).count(), 1);
  assert.equal(await page.evaluate(() => document.querySelectorAll("script:not([src])").length > 0 && !!window.__xss), false);

  // 읽기 → 긴 편지 스크롤
  await page.getByRole("button", { name: /막내 민수님의 편지 열기/ }).click();
  const reader = page.getByRole("dialog", { name: "막내 민수님의 편지" });
  await reader.waitFor(); await page.waitForTimeout(400);
  await shot(page, "09-read");
  const scrolled = await page.evaluate(() => { const el = [...document.querySelectorAll('[role=dialog] div')].find((d) => getComputedStyle(d).overflowY === "auto"); const before = el.scrollTop; el.scrollTop = 99999; return { can: el.scrollHeight > el.clientHeight, moved: el.scrollTop > before, bodyOverflow: getComputedStyle(document.body).overflow }; });
  console.log("scroll", scrolled); assert.ok(scrolled.can && scrolled.moved); assert.equal(scrolled.bodyOverflow, "hidden");
  await shot(page, "10-read-scrolled");

  // 수정: 틀린 비밀번호
  await page.getByRole("button", { name: "수정하기" }).click();
  await page.getByLabel("비밀번호 숫자 4자리").fill("0000");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await page.getByText("비밀번호가 일치하지 않습니다.").waitFor();
  await shot(page, "11-wrong-password");
  await page.getByLabel("비밀번호 숫자 4자리").fill("1234");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await page.getByRole("dialog", { name: "편지 수정" }).waitFor();
  await page.getByLabel("닉네임").fill("막내 민수(수정)");
  await page.getByRole("button", { name: "수정 저장" }).click();
  await page.getByText("편지를 수정했어요").waitFor();
  await page.getByRole("dialog", { name: "막내 민수(수정)님의 편지" }).waitFor();
  console.log("edit OK");

  // 삭제
  await page.getByRole("button", { name: "삭제하기" }).click();
  await page.getByLabel("비밀번호 숫자 4자리").fill("1234");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await page.getByText("정말 이 편지를 삭제하시겠어요?").waitFor();
  await shot(page, "12-delete-confirm");
  await page.getByRole("button", { name: "편지 삭제" }).click();
  await page.getByText("편지를 삭제했어요").waitFor();
  await page.waitForTimeout(500);
  assert.equal(await page.getByRole("button", { name: "1번 봉투, 아직 비어 있어요" }).count(), 1);
  console.log("delete OK → slot reusable");

  // 슬롯 충돌: 다른 사람이 먼저 저장
  await page.getByRole("button", { name: "2번 봉투, 아직 비어 있어요" }).click();
  await page.getByLabel("닉네임").fill("늦은 지수");
  await page.getByLabel("편지 내용").fill("제가 쓰던 내용이에요");
  await page.getByLabel(/비밀번호/).fill("4321");
  await fetch(B + "/api/letters", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slot_number: 2, nickname: "선착순 하나", content: "먼저 썼어요", password: "1111" }) });
  await page.getByRole("button", { name: "저장하기" }).click();
  await page.getByText("다른 분이 먼저 작성했어요.").first().waitFor();
  assert.equal(await page.getByLabel("편지 내용").inputValue(), "제가 쓰던 내용이에요");
  await shot(page, "13-slot-conflict");
  await page.getByRole("button", { name: "빈 봉투에 이어서 쓰기" }).click();
  await page.getByRole("button", { name: "저장하기" }).click();
  await page.getByText("편지가 봉투에 담겼어요").waitFor();
  console.log("conflict → move to empty slot OK");

  // 나머지 채우기 (API) 후 미리보기
  for (const [slot, nick] of [[3, "정우"], [4, "하은"], [5, "서연"]]) await fetch(B + "/api/letters", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slot_number: slot, nickname: nick, content: `${nick}의 편지입니다. 건강하세요!`, password: "1111" }) });
  await page.reload(); await page.getByRole("group").waitFor(); await page.waitForTimeout(800);
  await shot(page, "14-board-full");
  const pos1 = await envs.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)]; }));
  await page.reload(); await page.getByRole("group").waitFor(); await page.waitForTimeout(500);
  const pos2 = await envs.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y)]; }));
  assert.deepEqual(pos1, pos2); console.log("layout stable across reload OK");
  const opacity = await page.locator("button[aria-label*='번 봉투'] svg").first().evaluate((e) => getComputedStyle(e).opacity);
  assert.equal(opacity, "0.6");

  await page.getByRole("button", { name: "완성본 미리보기" }).click();
  await page.waitForURL("**/view");
  await page.getByRole("group").waitFor(); await page.waitForTimeout(700);
  await shot(page, "15-view");
  assert.equal(await page.getByRole("button", { name: "편집으로 돌아가기" }).count(), 1);
  await page.getByRole("button", { name: /서연님의 편지 열기/ }).click();
  await page.getByRole("dialog", { name: "서연님의 편지" }).waitFor(); await page.waitForTimeout(400);
  assert.equal(await page.getByRole("button", { name: "수정하기" }).count() + await page.getByRole("button", { name: "삭제하기" }).count(), 0);
  await shot(page, "16-view-letter");
  await page.getByRole("button", { name: "닫기" }).click();

  // 독립 완성본 링크: 새 컨텍스트 → 편집 복귀 버튼 없음
  const ctx2 = await browser.newContext({ ...devices["Pixel 7"] });
  const p2 = await ctx2.newPage();
  await p2.goto(B + "/view"); await p2.getByRole("group").waitFor();
  assert.equal(await p2.getByRole("button", { name: /편집|미리보기/ }).count(), 0);
  await fetch(F + "/__reset"); // 비어 있는 상태에서 빈 봉투 안내
  await p2.reload(); await p2.getByRole("group").waitFor();
  await p2.getByRole("button", { name: "1번 봉투, 아직 비어 있어요" }).click();
  await p2.getByText("아직 편지가 도착하지 않았어요.").waitFor();
  console.log("view standalone OK");

  // 루트 접근은 /view로
  const p3 = await ctx2.newPage(); await p3.goto(B + "/"); assert.ok(p3.url().endsWith("/view"));

  console.log("page errors:", errors.filter((e) => !/favicon|fonts\.g/.test(e)));
  await browser.close();
})().catch((e) => { console.error("UI FAIL:", e.message); process.exit(1); });
