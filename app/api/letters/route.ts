import { createLetterSchema } from "@/lib/validation/letter";
import { hashPassword } from "@/lib/security/password";
import { allow } from "@/lib/security/rateLimit";
import { clientIp, fail, json, parseBody, serverError, tooMany } from "@/lib/server/http";
import { LETTER_PUBLIC_COLUMNS, listLetters } from "@/lib/server/repo";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json({ letters: await listLetters() });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: Request) {
  try {
    if (!(await allow(`create:${clientIp(req)}`, 10, 60))) return tooMany();

    const body = await parseBody(req, createLetterSchema);
    if (!body.ok) return body.response;
    const { slot_number, nickname, content, password } = body.data;

    const password_hash = await hashPassword(password);
    const { data, error } = await supabaseAdmin()
      .from("letters")
      .insert({ slot_number, nickname, content, password_hash })
      .select(LETTER_PUBLIC_COLUMNS)
      .single();

    if (error) {
      // slot_number UNIQUE 위반: 같은 봉투에 먼저 저장한 요청이 있다.
      if (error.code === "23505") return fail(409, "slot_taken", "다른 분이 먼저 작성했어요.");
      throw new Error(`createLetter: ${error.message}`);
    }
    return json({ letter: data }, 201);
  } catch (error) {
    return serverError(error);
  }
}
