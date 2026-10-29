import "server-only";
import sharp from "sharp";

export const MAX_BACKGROUND_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 60_000_000;
const MAX_EDGE = 1600;

export class ImageError extends Error {
  constructor(readonly code: "unsupported" | "decode") {
    super(code);
  }
}

/** 확장자·Content-Type이 아니라 파일 앞부분(매직 바이트)으로 실제 형식을 확인한다. */
export function detectFormat(buf: Buffer): "jpeg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}

/** 형식 확인 → 실제 디코딩 → EXIF 회전 반영·메타데이터 제거·크기 최적화(WebP). */
export async function normalizeBackground(input: Buffer): Promise<Buffer> {
  if (!detectFormat(input)) throw new ImageError("unsupported");
  try {
    return await sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ImageError("decode");
  }
}
