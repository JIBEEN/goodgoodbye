"use client";

import { useState } from "react";
import DialogShell from "./DialogShell";
import { ApiError } from "@/lib/client/api";
import type { VerifyAction } from "@/lib/types";

interface Props {
  action: VerifyAction;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
}

export default function PasswordDialog({ action, onSubmit, onCancel }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!/^[0-9]{4}$/.test(password)) {
      setError("숫자 4자리를 입력해 주세요.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "일시적인 오류가 생겼어요. 잠시 후 다시 시도해 주세요.");
      setPassword("");
    } finally {
      setPending(false);
    }
  }

  return (
    <DialogShell title="비밀번호를 입력해 주세요" onCancel={onCancel}>
      <form onSubmit={submit} noValidate>
        <p className="mt-2 text-[15px] leading-relaxed">
          편지를 쓸 때 정한 숫자 4자리로 {action === "edit" ? "수정" : "삭제"}할 수 있어요.
        </p>
        <label htmlFor="verify-password" className="sr-only">
          비밀번호 숫자 4자리
        </label>
        <input
          id="verify-password"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoComplete="off"
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value.replace(/\D/g, "").slice(0, 4));
            setError("");
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "verify-error" : undefined}
          className="mt-4 h-14 w-full rounded-2xl border-2 border-brown/60 bg-white/70 text-center text-2xl tracking-[0.6em] outline-none focus:border-sage"
        />
        <p id="verify-error" role="alert" className="mt-2 min-h-6 text-sm font-medium text-danger">
          {error}
        </p>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 flex-1 rounded-full border border-brown bg-transparent text-base font-semibold"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 flex-1 rounded-full bg-sage text-base font-semibold text-white disabled:opacity-60"
          >
            확인
          </button>
        </div>
      </form>
    </DialogShell>
  );
}
