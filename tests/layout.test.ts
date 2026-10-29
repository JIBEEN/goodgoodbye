import { test } from "node:test";
import assert from "node:assert/strict";
import { placeEnvelopes } from "../lib/layout/envelopes.ts";

test("같은 시드는 항상 같은 배치", () => {
  assert.deepEqual(placeEnvelopes("abc"), placeEnvelopes("abc"));
  assert.notDeepEqual(placeEnvelopes("abc"), placeEnvelopes("abd"));
});

// 보드 크기(px): [폭, 높이]. 높이는 헤더·푸터를 뺀 영역(LetterBoard의 최소 높이는 500px).
const BOARDS: Array<[number, number]> = [
  [320, 500],
  [360, 500],
  [360, 524],
  [390, 724],
  [430, 812],
];

test("어떤 시드·화면에서도 봉투 5개가 겹치지 않고 보드 안에 들어온다", () => {
  for (let n = 0; n < 3000; n++) {
    const placements = placeEnvelopes(`seed-${n}`);
    assert.equal(placements.length, 5);
    for (const [W, H] of BOARDS) {
      const w = Math.min(W * 0.3, 140);
      const h = (w * 2) / 3;
      const boxes = placements.map((p) => {
        const rad = (Math.abs(p.rotate) * Math.PI) / 180;
        const bw = w * Math.cos(rad) + h * Math.sin(rad);
        const bh = w * Math.sin(rad) + h * Math.cos(rad);
        return { l: (p.x / 100) * W - bw / 2, r: (p.x / 100) * W + bw / 2, t: (p.y / 100) * H - bh / 2, b: (p.y / 100) * H + bh / 2 };
      });
      for (const [i, a] of boxes.entries()) {
        assert.ok(a.l >= 0 && a.r <= W && a.t >= 0 && a.b <= H, `seed-${n} ${W}x${H} #${i} 보드 밖`);
        for (const b of boxes.slice(i + 1)) {
          const overlap = a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
          assert.ok(!overlap, `seed-${n} ${W}x${H} 겹침`);
        }
      }
    }
  }
});

test("봉투 번호가 여러 자리에 고르게 섞인다", () => {
  const firstSlotY = new Set<number>();
  for (let n = 0; n < 200; n++) firstSlotY.add(Math.round(placeEnvelopes(`s${n}`)[0].y / 10));
  assert.ok(firstSlotY.size >= 4);
});
