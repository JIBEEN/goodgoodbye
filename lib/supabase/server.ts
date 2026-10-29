import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/server/env";

export const BACKGROUND_BUCKET = "backgrounds";

let client: SupabaseClient | null = null;

/** service_role 키를 쓰는 서버 전용 클라이언트. 브라우저 번들에 포함되면 안 된다. */
export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
