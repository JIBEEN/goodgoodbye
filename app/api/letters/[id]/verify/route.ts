import { verifySchema } from "@/lib/validation/letter";
import { verifyPassword } from "@/lib/security/password";
import { allow } from "@/lib/security/rateLimit";
import { issueToken, TOKEN_TTL_SECONDS } from "@/lib/security/token";
import { clientIp, fail, isUuid, json, parseBody, serverError, tooMany } from "@/lib/server/http";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return fail(404, "not_found", "편지를 찾을 수 없어요.");

    // 4자리 숫자는 대입 공격에 약하므로 두 겹으로 제한한다.
    //  - 편지 하나당: 접속 위치와 무관하게 10분에 10번 (이 한도가 사실상의 대입 방어선)
    //  - 접속 위치(IP)당: 10분에 30번
    if (!(await allow(`verify:letter:${id}`, 10, 600))) return tooMany();
    if (!(await allow(`verify:ip:${clientIp(req)}`, 30, 600))) return tooMany();

    const body = await parseBody(req, verifySchema);
    if (!body.ok) return body.response;

    const { data, error } = await supabaseAdmin().from("letters").select("password_hash").eq("id", id).maybeSingle();
    if (error) throw new Error(`verify lookup: ${error.message}`);
    if (!data) return fail(404, "not_found", "편지를 찾을 수 없어요.");

    if (!(await verifyPassword(data.password_hash, body.data.password))) {
      return fail(401, "wrong_password", "비밀번호가 일치하지 않습니다.");
    }
    return json({ token: issueToken(id, body.data.action), expires_in: TOKEN_TTL_SECONDS });
  } catch (error) {
    return serverError(error);
  }
}
