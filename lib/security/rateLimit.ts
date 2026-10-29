import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/** 허용되면 true, 한도를 넘으면 false. DB 함수로 원자적으로 센다. */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`rate limit check failed: ${error.message}`);
  return data === true;
}
