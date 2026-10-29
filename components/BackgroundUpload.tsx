"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import DialogShell from "./DialogShell";
import { ApiError, uploadBackground } from "@/lib/client/api";
import { ImageSelectError, prepareBackground } from "@/lib/client/image";

interface Props {
  /** 서버에 등록이 끝났거나 이미 등록되어 있을 때 */
  onDone: () => void;
}

export default function BackgroundUpload({ onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prepared, setPrepared] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 고를 수 있게
    if (!file) return;
    setError("");
    setProcessing(true);
    try {
      const blob = await prepareBackground(file);
      setPrepared(blob);
      setPreview(URL.createObjectURL(blob));
    } catch (err) {
      setPrepared(null);
      setPreview(null);
      setError(err instanceof ImageSelectError ? err.message : "사진을 읽을 수 없어요. 다른 사진으로 시도해 주세요.");
    } finally {
      setProcessing(false);
    }
  }

  async function upload() {
    if (!prepared || uploading) return;
    setConfirming(false);
    setUploading(true);
    setProgress(0);
    setError("");
    try {
      await uploadBackground(prepared, setProgress);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === "already_set") {
        onDone(); // 서버 기준으로 이미 등록됨 → 최신 상태를 다시 불러온다
        return;
      }
      setError(err instanceof ApiError ? err.message : "업로드에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col px-5 pb-8 pt-10 safe-top safe-bottom">
      <h1 className="font-hand text-[32px] leading-tight">팀장님께 전하는 마음</h1>
      <p className="mt-2 text-base leading-relaxed">
        먼저 롤링페이퍼의 배경이 될 추억 사진을 한 장 골라 주세요.
      </p>

      <div className="mt-6 rounded-2xl border border-brown/50 bg-white/60 p-4 text-[15px] leading-relaxed">
        <p className="font-semibold">⚠ 사진은 딱 한 번만 등록할 수 있어요</p>
        <p className="mt-1">등록하고 나면 바꾸거나 지울 수 없어요. 팀원들에게 링크를 공유하기 전에 먼저 올려 주세요.</p>
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-brown/60 bg-envelope/40">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="선택한 배경 사진 미리보기" className="h-full w-full object-cover" />
          ) : (
            <p className="px-6 text-center text-base">{processing ? "사진을 준비하는 중이에요…" : "JPG · PNG · WebP, 10MB 이하"}</p>
          )}
        </div>

        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPick} tabIndex={-1} aria-hidden />

        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-danger/10 p-3 text-[15px] font-medium text-danger">
            {error}
          </p>
        )}

        {uploading && (
          <div className="mt-4" role="status" aria-live="polite">
            <div className="h-3 overflow-hidden rounded-full bg-envelope">
              <div className="h-full rounded-full bg-sage transition-[width] duration-200" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1.5 text-center text-sm">{progress < 100 ? `업로드 중… ${progress}%` : "저장하는 중이에요…"}</p>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-6">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || processing}
            className="min-h-12 rounded-full border border-brown text-base font-semibold disabled:opacity-60"
          >
            {preview ? "다른 사진 고르기" : "사진 고르기"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!prepared || uploading || processing}
            className="min-h-12 rounded-full bg-sage text-base font-semibold text-white disabled:opacity-50"
          >
            이 사진으로 등록하기
          </button>
        </div>
      </div>

      <AnimatePresence>
        {confirming && (
          <DialogShell title="이 사진으로 등록할까요?" onCancel={() => setConfirming(false)}>
            <p className="mt-2 text-[15px] leading-relaxed">
              한 번 등록하면 <strong>바꾸거나 삭제할 수 없어요.</strong>
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                autoFocus
                className="min-h-12 flex-1 rounded-full border border-brown text-base font-semibold"
              >
                다시 고를게요
              </button>
              <button type="button" onClick={upload} className="min-h-12 flex-1 rounded-full bg-sage text-base font-semibold text-white">
                등록하기
              </button>
            </div>
          </DialogShell>
        )}
      </AnimatePresence>
    </main>
  );
}
