export interface Letter {
  id: string;
  slot_number: number;
  nickname: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectPublic {
  title: string;
  background_image_url: string | null;
  background_locked: boolean;
  layout_seed: string;
}

export type VerifyAction = "edit" | "delete";

export const SLOT_COUNT = 5;
