import { allow } from "@/lib/security/rateLimit";
import { clientIp, fail, json, serverError, tooMany } from "@/lib/server/http";
import { ImageError, MAX_BACKGROUND_BYTES, normalizeBackground } from "@/lib/server/image";
import { backgroundUrl, getProjectRow } from "@/lib/server/repo";
import { BACKGROUND_BUCKET, supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALREADY = () => fail(409, "already_set", "이미 배경 사진이 등록되어 있어요.");

export async function POST(req: Request) {
  const db = supabaseAdmin();
  let reservation: string | null = null;
  let storedPath: string | null = null;

  try {
    if (!(await allow(`background:${clientIp(req)}`, 6, 600))) return tooMany();

    // 이미 등록되었다면 파일을 읽기 전에 거절한다.
    if ((await getProjectRow()).background_upload_state === "completed") return ALREADY();

    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_BACKGROUND_BYTES + 64 * 1024) {
      return fail(413, "too_large", "사진은 10MB 이하만 올릴 수 있어요.");
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail(400, "invalid_form", "업로드 요청이 올바르지 않아요.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) return fail(400, "no_file", "사진을 선택해 주세요.");
    if (file.size > MAX_BACKGROUND_BYTES) return fail(413, "too_large", "사진은 10MB 이하만 올릴 수 있어요.");

    // 예약을 잡기 전에 파일부터 검증해, 잘못된 파일이 등록 기회를 막지 않게 한다.
    let image: Buffer;
    try {
      image = await normalizeBackground(Buffer.from(await file.arrayBuffer()));
    } catch (error) {
      if (error instanceof ImageError) {
        return fail(
          400,
          error.code === "unsupported" ? "unsupported_type" : "undecodable",
          error.code === "unsupported"
            ? "JPG, PNG, WebP 사진만 올릴 수 있어요."
            : "사진을 읽을 수 없어요. 다른 사진으로 시도해 주세요.",
        );
      }
      throw error;
    }

    // 등록 권한을 DB에서 원자적으로 선점한다. 선점에 성공한 요청 하나만 계속 진행한다.
    const reserved = await db.rpc("reserve_background");
    if (reserved.error) throw new Error(`reserve: ${reserved.error.message}`);
    reservation = (reserved.data as string | null) ?? null;
    if (!reservation) {
      if ((await getProjectRow()).background_upload_state === "completed") return ALREADY();
      return fail(409, "upload_in_progress", "다른 분이 사진을 올리는 중이에요. 잠시 후 다시 확인해 주세요.");
    }

    storedPath = `background/${reservation}.webp`;
    const uploaded = await db.storage.from(BACKGROUND_BUCKET).upload(storedPath, image, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploaded.error) throw new Error(`storage upload: ${uploaded.error.message}`);

    const completed = await db.rpc("complete_background", { p_reservation: reservation, p_path: storedPath });
    if (completed.error) throw new Error(`complete: ${completed.error.message}`);
    if (completed.data !== true) {
      // 예약이 만료되어 다른 요청이 가져갔다. 방금 올린 파일은 정리한다.
      await db.storage.from(BACKGROUND_BUCKET).remove([storedPath]);
      storedPath = null;
      reservation = null;
      return fail(409, "reservation_lost", "업로드 시간이 너무 길어졌어요. 다시 시도해 주세요.");
    }

    reservation = null; // 확정 완료: 실패 시 정리 대상이 아니다.
    storedPath = null;
    const row = await getProjectRow();
    return json({ background_image_url: backgroundUrl(row.background_image_path) }, 201);
  } catch (error) {
    // 실패하면 예약을 되돌려 재시도할 수 있게 한다.
    if (storedPath) await db.storage.from(BACKGROUND_BUCKET).remove([storedPath]).catch(() => undefined);
    if (reservation) await db.rpc("release_background", { p_reservation: reservation }).then(undefined, () => undefined);
    return serverError(error);
  }
}
