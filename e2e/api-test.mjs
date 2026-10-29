// 테스트 전용: 서버(next start, :3100)와 가짜 Supabase(:54321)가 떠 있어야 한다. e2e/README 참고.
import assert from "node:assert/strict";
import sharp from "sharp";
const B = "http://127.0.0.1:3100", F = "http://127.0.0.1:54321";
const j = async (path, init = {}, base = B) => { const r = await fetch(base + path, init); const t = await r.text(); let d; try { d = JSON.parse(t) } catch { d = t } return { s: r.status, d } };
const post = (p, body, token) => j(p, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const patch = (p, body, token) => j(p, { method: "PATCH", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const del = (p, token) => j(p, { method: "DELETE", headers: token ? { authorization: `Bearer ${token}` } : {} });
const results = []; const t = async (name, fn) => { try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e.message.split("\n")[0]]); } };
await j("/__reset", {}, F);

await t("GET /api/project: 배경 없음", async () => { const r = await j("/api/project"); assert.equal(r.s, 200); assert.equal(r.d.project.background_locked, false); assert.equal(r.d.project.background_image_url, null); assert.ok(r.d.project.layout_seed); });
await t("GET /api/letters: 비어 있음", async () => { const r = await j("/api/letters"); assert.deepEqual(r.d.letters, []); });

let letter;
await t("POST 편지 생성 201, 해시 미노출", async () => {
  const r = await post("/api/letters", { slot_number: 2, nickname: "  민수 ", content: "  감사합니다  ", password: "1234" });
  assert.equal(r.s, 201); letter = r.d.letter; assert.equal(letter.nickname, "민수"); assert.equal(letter.content, "감사합니다"); assert.equal(letter.password_hash, undefined);
  const st = await j("/__state", {}, F); assert.match(st.d.letters[0].password_hash, /^\$argon2id\$/); assert.ok(!st.d.letters[0].password_hash.includes("1234"));
});
await t("GET /api/letters에 password_hash 없음", async () => { const r = await j("/api/letters"); assert.equal(r.d.letters.length, 1); assert.equal("password_hash" in r.d.letters[0], false); });
await t("같은 봉투 재저장 409", async () => { const r = await post("/api/letters", { slot_number: 2, nickname: "b", content: "c", password: "1111" }); assert.equal(r.s, 409); assert.equal(r.d.error.message, "다른 분이 먼저 작성했어요."); });
await t("입력 검증 400 (빈 값/비밀번호/슬롯/글자수)", async () => {
  for (const bad of [{ nickname: "  " }, { content: "" }, { password: "12a4" }, { password: "123" }, { slot_number: 9 }, { content: "가".repeat(2001) }, { nickname: "가".repeat(21) }]) {
    const r = await post("/api/letters", { slot_number: 3, nickname: "n", content: "c", password: "1234", ...bad }); assert.equal(r.s, 400, JSON.stringify(bad));
  }
});
await t("잘못된 JSON 400", async () => { const r = await j("/api/letters", { method: "POST", body: "{bad" }); assert.equal(r.s, 400); });
await j("/__resetRate", {}, F);
await t("XSS 문자열은 그대로 저장(렌더 시 이스케이프)", async () => { const r = await post("/api/letters", { slot_number: 5, nickname: "<b>x</b>", content: "<script>alert(1)</script>", password: "0000" }); assert.equal(r.s, 201); assert.equal(r.d.letter.content, "<script>alert(1)</script>"); });

let editToken, delToken;
await t("verify 오답 401", async () => { const r = await post(`/api/letters/${letter.id}/verify`, { password: "9999", action: "edit" }); assert.equal(r.s, 401); assert.equal(r.d.error.message, "비밀번호가 일치하지 않습니다."); });
await t("verify 정답 → 토큰", async () => { const r = await post(`/api/letters/${letter.id}/verify`, { password: "1234", action: "edit" }); assert.equal(r.s, 200); editToken = r.d.token; const d = await post(`/api/letters/${letter.id}/verify`, { password: "1234", action: "delete" }); delToken = d.d.token; assert.ok(editToken && delToken); });
await t("토큰 없이 PATCH/DELETE 403", async () => {
  assert.equal((await patch(`/api/letters/${letter.id}`, { nickname: "x", content: "y", updated_at: letter.updated_at })).s, 403);
  assert.equal((await del(`/api/letters/${letter.id}`)).s, 403);
});
await t("토큰 위조/변조/다른 작업/다른 편지 거절", async () => {
  const [b, sig] = editToken.split(".");
  assert.equal((await patch(`/api/letters/${letter.id}`, { nickname: "x", content: "y", updated_at: letter.updated_at }, `${b}.${sig.slice(0, -2)}AA`)).s, 403);
  assert.equal((await patch(`/api/letters/${letter.id}`, { nickname: "x", content: "y", updated_at: letter.updated_at }, delToken)).s, 403, "삭제 토큰으로 수정");
  assert.equal((await del(`/api/letters/${letter.id}`, editToken)).s, 403, "수정 토큰으로 삭제");
  const other = (await j("/api/letters")).d.letters.find((l) => l.slot_number === 5);
  assert.equal((await patch(`/api/letters/${other.id}`, { nickname: "x", content: "y", updated_at: other.updated_at }, editToken)).s, 403, "다른 편지에 토큰 사용");
  const forged = Buffer.from(JSON.stringify({ lid: other.id, act: "edit", exp: 9999999999 })).toString("base64url") + ".AAAA";
  assert.equal((await patch(`/api/letters/${other.id}`, { nickname: "x", content: "y", updated_at: other.updated_at }, forged)).s, 403, "위조 토큰");
});
await t("PATCH 수정 200 + updated_at 갱신", async () => {
  const r = await patch(`/api/letters/${letter.id}`, { nickname: "민수2", content: "수정됨", updated_at: letter.updated_at }, editToken);
  assert.equal(r.s, 200); assert.equal(r.d.letter.content, "수정됨"); assert.notEqual(r.d.letter.updated_at, letter.updated_at); assert.equal(r.d.letter.slot_number, 2);
});
await t("오래된 updated_at으로 PATCH → 409 충돌", async () => {
  const r = await patch(`/api/letters/${letter.id}`, { nickname: "x", content: "y", updated_at: letter.updated_at }, editToken);
  assert.equal(r.s, 409);
});
await t("DELETE 삭제 후 재작성 가능", async () => {
  assert.equal((await del(`/api/letters/${letter.id}`, delToken)).s, 200);
  assert.equal((await j("/api/letters")).d.letters.some((l) => l.slot_number === 2), false);
  assert.equal((await del(`/api/letters/${letter.id}`, delToken)).s, 404);
  assert.equal((await post("/api/letters", { slot_number: 2, nickname: "새로운", content: "다시", password: "5555" })).s, 201);
});
await t("잘못된 id 404", async () => { assert.equal((await del(`/api/letters/not-a-uuid`, "x")).s, 404); });

await j("/__resetRate", {}, F);
await t("동시 저장: 같은 봉투 10건 → 1건만 201, 나머지 409", async () => {
  const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => post("/api/letters", { slot_number: 1, nickname: `n${i}`, content: "동시", password: "1234" })));
  const codes = rs.map((r) => r.s).sort(); assert.deepEqual(codes.filter((c) => c === 201).length, 1); assert.ok(codes.every((c) => c === 201 || c === 409), codes.join());
});

await t("verify 시도 제한: 편지당 10회 후 429", async () => {
  const l = (await j("/api/letters")).d.letters.find((x) => x.slot_number === 5);
  const codes = []; for (let i = 0; i < 13; i++) codes.push((await post(`/api/letters/${l.id}/verify`, { password: "9999", action: "edit" })).s);
  assert.equal(codes.filter((c) => c === 401).length, 10, codes.join()); assert.equal(codes.at(-1), 429);
  const ok = await post(`/api/letters/${l.id}/verify`, { password: "0000", action: "edit" }); assert.equal(ok.s, 429, "한도 초과 후에는 정답도 거절");
  const m = await post(`/api/letters/${l.id}/verify`, { password: "0000", action: "edit" }); assert.equal(m.d.error.message, "잠시 후 다시 시도해 주세요.");
});

// ---- 배경 사진
const mk = async (w, h, fmt = "jpeg") => sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 150, b: 120 } } })[fmt]().toBuffer();
const upload = (buf, type = "image/jpeg", name = "a.jpg") => { const f = new FormData(); f.append("file", new Blob([buf], { type }), name); return j("/api/project/background", { method: "POST", body: f }); };
await j("/__reset", {}, F);
await t("배경: 이미지가 아닌 파일(확장자만 jpg) 거절 400", async () => { const r = await upload(Buffer.from("<html>not an image</html>"), "image/jpeg"); assert.equal(r.s, 400); assert.equal(r.d.error.code, "unsupported_type"); });
await t("배경: 깨진 JPEG 거절 400", async () => { const good = await mk(100, 100); const r = await upload(Buffer.concat([good.subarray(0, 200), Buffer.alloc(300, 7)])); assert.equal(r.s, 400); assert.equal(r.d.error.code, "undecodable"); });
await t("배경: GIF 거절", async () => { const r = await upload(await mk(50, 50, "gif"), "image/gif", "a.gif"); assert.equal(r.s, 400); });
await t("배경: 10MB 초과 413", async () => { const r = await upload(Buffer.alloc(10 * 1024 * 1024 + 10, 1)); assert.equal(r.s, 413); });
await t("검증 실패는 등록 기회를 소모하지 않음", async () => { assert.equal((await j("/api/project")).d.project.background_locked, false); assert.equal((await j("/__state", {}, F)).d.project.background_upload_state, "empty"); });
await j("/__resetRate", {}, F);
await t("배경: Storage 실패 → 예약 복구 후 재시도 성공", async () => {
  await j("/__failNextUpload", {}, F); const r1 = await upload(await mk(2400, 1800)); assert.equal(r1.s, 500);
  assert.equal((await j("/__state", {}, F)).d.project.background_upload_state, "empty");
  const r2 = await upload(await mk(2400, 1800)); assert.equal(r2.s, 201); assert.match(r2.d.background_image_url, /\/storage\/v1\/object\/public\/backgrounds\/background\/.+\.webp$/);
});
await j("/__resetRate", {}, F);
await t("배경: 등록 후 잠금(409) 및 공개 설정 반영", async () => {
  const r = await upload(await mk(100, 100)); assert.equal(r.s, 409); assert.equal(r.d.error.code, "already_set");
  const p = (await j("/api/project")).d.project; assert.equal(p.background_locked, true); assert.ok(p.background_image_url);
  const st = (await j("/__state", {}, F)).d; assert.equal(st.objects.length, 1);
});
await j("/__reset", {}, F);
await t("배경: 동시 업로드 6건 → 1건만 201, 저장 파일 1개", async () => {
  const buf = await mk(1200, 900); const rs = await Promise.all(Array.from({ length: 6 }, () => upload(buf)));
  const ok = rs.filter((r) => r.s === 201).length; assert.equal(ok, 1, rs.map((r) => r.s).join()); assert.ok(rs.every((r) => [201, 409].includes(r.s)));
  assert.equal((await j("/__state", {}, F)).d.objects.length, 1);
});
await j("/__reset", {}, F);
await t("배경: 업로드 이미지는 1600px 이내 WebP로 변환", async () => {
  const r = await upload(await mk(4000, 3000, "png"), "image/png", "a.png"); assert.equal(r.s, 201);
});
await t("배경: 만료된 예약은 영구히 막지 않음", async () => {
  await j("/__reset", {}, F);
  await fetch(F + "/rest/v1/rpc/reserve_background", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal((await upload(await mk(100, 100))).s, 409, "예약 중");
  await j("/__expireReservation", {}, F);
  assert.equal((await upload(await mk(100, 100))).s, 201, "만료 후 인계");
});

for (const r of results) console.log(r.join("  "));
console.log(`\n${results.filter((r) => r[0] === "PASS").length}/${results.length} passed`);
