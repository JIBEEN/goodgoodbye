import "server-only";
import { BACKGROUND_BUCKET, supabaseAdmin } from "@/lib/supabase/server";
import type { Letter, ProjectPublic } from "@/lib/types";

// password_hash는 어떤 공개 응답에도 포함하지 않는다.
export const LETTER_PUBLIC_COLUMNS = "id, slot_number, nickname, content, created_at, updated_at";

export async function listLetters(): Promise<Letter[]> {
  const { data, error } = await supabaseAdmin()
    .from("letters")
    .select(LETTER_PUBLIC_COLUMNS)
    .order("slot_number", { ascending: true });
  if (error) throw new Error(`listLetters: ${error.message}`);
  return (data ?? []) as Letter[];
}

export interface ProjectRow {
  id: string;
  title: string;
  background_image_path: string | null;
  background_upload_state: "empty" | "reserved" | "completed";
  layout_seed: string;
}

export async function getProjectRow(): Promise<ProjectRow> {
  const db = supabaseAdmin();
  const columns = "id, title, background_image_path, background_upload_state, layout_seed";
  const found = await db.from("project_settings").select(columns).limit(1).maybeSingle();
  if (found.error) throw new Error(`getProject: ${found.error.message}`);
  if (found.data) return found.data as ProjectRow;

  // 마이그레이션이 기본 행을 만들지만, 혹시 없으면 한 번만 만든다.
  const created = await db
    .from("project_settings")
    .upsert({ singleton: true }, { onConflict: "singleton", ignoreDuplicates: true })
    .select(columns)
    .maybeSingle();
  if (created.error) throw new Error(`createProject: ${created.error.message}`);
  if (created.data) return created.data as ProjectRow;

  const retry = await db.from("project_settings").select(columns).limit(1).single();
  if (retry.error) throw new Error(`getProject retry: ${retry.error.message}`);
  return retry.data as ProjectRow;
}

export function backgroundUrl(path: string | null): string | null {
  if (!path) return null;
  return supabaseAdmin().storage.from(BACKGROUND_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function toProjectPublic(row: ProjectRow): ProjectPublic {
  const locked = row.background_upload_state === "completed";
  return {
    title: row.title,
    background_image_url: locked ? backgroundUrl(row.background_image_path) : null,
    background_locked: locked,
    layout_seed: row.layout_seed,
  };
}
