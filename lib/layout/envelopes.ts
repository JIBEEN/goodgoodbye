const SLOT_COUNT = 5;

export interface EnvelopePlacement {
  /** 보드 폭·높이 대비 중심 좌표(%) */
  x: number;
  y: number;
  /** 기울기(도) */
  rotate: number;
}

// 미리 검증해 둔 안전한 배치 후보. 봉투 폭(보드의 30%)과 간격을 고려해
// 어떤 두 봉투도 겹치지 않고, 가장자리·제목·하단 안내를 침범하지 않는다.
const CANDIDATES: EnvelopePlacement[][] = [
  [{ x: 30, y: 14, rotate: -6 }, { x: 72, y: 28, rotate: 5 }, { x: 32, y: 46, rotate: 3 }, { x: 70, y: 64, rotate: -5 }, { x: 30, y: 83, rotate: 4 }],
  [{ x: 68, y: 13, rotate: 5 }, { x: 28, y: 27, rotate: -4 }, { x: 70, y: 45, rotate: -6 }, { x: 28, y: 61, rotate: 6 }, { x: 68, y: 82, rotate: -3 }],
  [{ x: 26, y: 16, rotate: -5 }, { x: 68, y: 24, rotate: 4 }, { x: 34, y: 44, rotate: 5 }, { x: 72, y: 58, rotate: -4 }, { x: 36, y: 78, rotate: -6 }],
  [{ x: 70, y: 15, rotate: -4 }, { x: 32, y: 30, rotate: 6 }, { x: 68, y: 48, rotate: 4 }, { x: 28, y: 65, rotate: -5 }, { x: 68, y: 83, rotate: 5 }],
  [{ x: 32, y: 12, rotate: 4 }, { x: 70, y: 22, rotate: -5 }, { x: 30, y: 40, rotate: -3 }, { x: 68, y: 56, rotate: 6 }, { x: 48, y: 76, rotate: -4 }],
];

function hashSeed(seed: string): number {
  // FNV-1a
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 프로젝트별 시드로 배치를 정한다. 같은 시드는 언제나 같은 결과를 내므로
 * 새로고침해도 위치가 바뀌지 않는다. 반환 배열의 index 0 = 1번 봉투.
 */
export function placeEnvelopes(seed: string): EnvelopePlacement[] {
  const rand = mulberry32(hashSeed(seed));
  const base = CANDIDATES[Math.floor(rand() * CANDIDATES.length)];

  // 어느 봉투 번호가 어느 자리에 놓일지 섞는다 (Fisher–Yates).
  const order = Array.from({ length: SLOT_COUNT }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  // 안전 여백을 넘지 않는 작은 흔들림으로 자연스러움을 더한다.
  return order.map((positionIndex) => {
    const p = base[positionIndex];
    return {
      x: round(p.x + (rand() - 0.5) * 3),
      y: round(p.y + (rand() - 0.5) * 2),
      rotate: round(p.rotate + (rand() - 0.5) * 4),
    };
  });
}

const round = (n: number) => Math.round(n * 10) / 10;
