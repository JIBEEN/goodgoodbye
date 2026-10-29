import type { Letter, ProjectPublic, VerifyAction } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const NETWORK_MESSAGE = "네트워크 연결을 확인하고 다시 시도해 주세요.";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(0, "network", NETWORK_MESSAGE);
  }
  return parse<T>(res.status, await res.text());
}

function parse<T>(status: number, text: string): T {
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // JSON이 아닌 응답(예: 플랫폼 오류 페이지)
  }
  if (status >= 200 && status < 300) return data as T;
  const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
  const fallback =
    status === 413 ? "사진 용량이 너무 커요." : status === 429 ? "잠시 후 다시 시도해 주세요." : "일시적인 오류가 생겼어요. 잠시 후 다시 시도해 주세요.";
  throw new ApiError(status, error?.code ?? "unknown", error?.message ?? fallback);
}

const jsonInit = (method: string, body: unknown, token?: string): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

export const fetchProject = () => request<{ project: ProjectPublic }>("/api/project").then((r) => r.project);

export const fetchLetters = () => request<{ letters: Letter[] }>("/api/letters").then((r) => r.letters);

export const createLetter = (input: { slot_number: number; nickname: string; content: string; password: string }) =>
  request<{ letter: Letter }>("/api/letters", jsonInit("POST", input)).then((r) => r.letter);

export const verifyLetter = (id: string, password: string, action: VerifyAction) =>
  request<{ token: string }>(`/api/letters/${id}/verify`, jsonInit("POST", { password, action })).then((r) => r.token);

export const updateLetter = (
  id: string,
  token: string,
  input: { nickname: string; content: string; updated_at: string },
) => request<{ letter: Letter }>(`/api/letters/${id}`, jsonInit("PATCH", input, token)).then((r) => r.letter);

export const deleteLetter = (id: string, token: string) =>
  request<{ ok: true }>(`/api/letters/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });

/** 업로드 진행률을 알려 주기 위해 XMLHttpRequest를 쓴다. */
export function uploadBackground(file: Blob, onProgress: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/project/background");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new ApiError(0, "network", NETWORK_MESSAGE));
    xhr.onload = () => {
      try {
        resolve(parse<{ background_image_url: string }>(xhr.status, xhr.responseText).background_image_url);
      } catch (error) {
        reject(error);
      }
    };
    const form = new FormData();
    form.append("file", file, "background.jpg");
    xhr.send(form);
  });
}
