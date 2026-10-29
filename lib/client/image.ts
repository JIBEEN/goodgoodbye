export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 1600;
// 서버리스 플랫폼의 요청 본문 한도(약 4.5MB)보다 작게 유지한다.
const TARGET_BYTES = 3.5 * 1024 * 1024;

export class ImageSelectError extends Error {}

function loadBitmap(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" }).then(
      (bmp) => ({ source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }),
      () => loadWithImageElement(file),
    );
  }
  return loadWithImageElement(file);
}

function loadWithImageElement(file: File) {
  return new Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageSelectError("사진을 읽을 수 없어요. 다른 사진으로 시도해 주세요."));
    };
    img.src = url;
  });
}

/** 선택한 사진을 검사하고, 모바일 업로드에 알맞게 줄인 JPEG로 바꿔 돌려준다. */
export async function prepareBackground(file: File): Promise<Blob> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new ImageSelectError("JPG, PNG, WebP 사진만 올릴 수 있어요.");
  if (file.size > MAX_FILE_BYTES) throw new ImageSelectError("사진은 10MB 이하만 올릴 수 있어요.");

  const bitmap = await loadBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageSelectError("이 기기에서는 사진을 처리할 수 없어요.");
    ctx.fillStyle = "#F8F1E5"; // 투명 PNG 배경
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap.source, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.88, 0.75, 0.6]) {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
      if (blob && blob.size <= TARGET_BYTES) return blob;
    }
    throw new ImageSelectError("사진을 충분히 줄이지 못했어요. 다른 사진으로 시도해 주세요.");
  } finally {
    bitmap.close();
  }
}
