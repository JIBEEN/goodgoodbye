import { updateLetterSchema } from "@/lib/validation/letter";
import { allow } from "@/lib/security/rateLimit";
import { checkToken } from "@/lib/security/token";
import { bearer, clientIp, fail, isUuid, json, parseBody, serverError, tooMany } from "@/lib/server/http";
import { LETTER_PUBLIC_COLUMNS } from "@/lib/server/repo";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => fail(404, "not_found", "편지를 찾을 수 없어요.");
const unauthorized = () => fail(403, "forbidden", "인증이 만료되었어요. 비밀번호를 다시 확인해 주세요.");

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    if (!(await allow(`write:${clientIp(req)}`, 20, 60))) return tooMany();
    if (!checkToken(bearer(req), id, "edit")) return unauthorized();

    const body = await parseBody(req, updateLetterSchema);
    if (!body.ok) return body.response;
    const { nickname, content, updated_at } = body.data;

    const db = supabaseAdmin();
    // 내가 본 버전(updated_at)과 같을 때만 갱신한다. 그 사이 바뀌었다면 0행이 갱신된다.
    const { data, error } = await db
      .from("letters")
      .update({ nickname, content, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("updated_at", updated_at)
      .select(LETTER_PUBLIC_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(`updateLetter: ${error.message}`);
    if (data) return json({ letter: data });

    const exists = await db.from("letters").select("id").eq("id", id).maybeSingle();
    if (exists.error) throw new Error(`updateLetter check: ${exists.error.message}`);
    if (!exists.data) return notFound();
    return fail(409, "conflict", "그 사이 편지가 바뀌었어요. 최신 내용을 불러온 뒤 다시 수정해 주세요.");
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    if (!(await allow(`write:${clientIp(req)}`, 20, 60))) return tooMany();
    if (!checkToken(bearer(req), id, "delete")) return unauthorized();

    const { data, error } = await supabaseAdmin().from("letters").delete().eq("id", id).select("id");
    if (error) throw new Error(`deleteLetter: ${error.message}`);
    if (!data || data.length === 0) return notFound();
    return json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
