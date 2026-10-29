"use client";

import { useEffect, useRef, useState } from "react";
import LetterFullscreen from "./LetterFullscreen";
import {
  CONTENT_MAX,
  NICKNAME_MAX,
  graphemeLength,
  validateLetterFields,
  type FieldErrors,
} from "@/lib/validation/letter";

export interface EditorValues {
  nickname: string;
  content: string;
  password: string;
}

interface Props {
  mode: "create" | "edit";
  initial: EditorValues;
  /** 실패하면 { error }를 돌려준다. 입력값은 그대로 유지된다. */
  onSubmit: (values: EditorValues) => Promise<{ error?: string } | void>;
  onClose: () => void;
  /** 작성 중 봉투를 다른 분이 먼저 채운 경우 */
  slotTaken?: boolean;
  onMoveToEmptySlot?: () => void;
  hasEmptySlot?: boolean;
}

const fieldClass =
  "w-full rounded-2xl border-2 bg-white/70 px-4 outline-none focus:border-sage aria-[invalid=true]:border-danger border-brown/50";

export default function LetterEditor({
  mode,
  initial,
  onSubmit,
  onClose,
  slotTaken,
  onMoveToEmptySlot,
  hasEmptySlot,
}: Props) {
  const [nickname, setNickname] = useState(initial.nickname);
  const [content, setContent] = useState(initial.content);
  const [password, setPassword] = useState(initial.password);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 내용에 맞춰 입력창 높이를 키우고, 스크롤은 편지지 본문 영역이 맡는다.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 240)}px`;
  }, [content]);

  const nicknameLength = graphemeLength(nickname.trim());
  const contentLength = graphemeLength(content.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current || slotTaken) return;

    const checked = validateLetterFields({ nickname, content, password }, mode === "create");
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setSubmitError("");
    inFlight.current = true;
    setSubmitting(true);
    try {
      const result = await onSubmit({ ...checked.value, password: checked.value.password });
      if (result?.error) setSubmitError(result.error);
    } catch {
      setSubmitError("일시적인 오류가 생겼어요. 입력한 내용은 그대로 두었으니 다시 시도해 주세요.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <LetterFullscreen
      label={mode === "create" ? "새 편지 쓰기" : "편지 수정"}
      heading={mode === "create" ? "팀장님께" : "편지 고치기"}
      onClose={onClose}
      footer={
        <button
          type="submit"
          form="letter-form"
          disabled={submitting || slotTaken}
          className="min-h-12 flex-1 rounded-full bg-sage text-base font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "저장 중…" : mode === "create" ? "저장하기" : "수정 저장"}
        </button>
      }
    >
      <form id="letter-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {slotTaken && (
          <div role="alert" className="rounded-2xl border border-danger/50 bg-white/70 p-4 text-[15px] leading-relaxed">
            <p className="font-semibold text-danger">다른 분이 먼저 작성했어요.</p>
            <p className="mt-1">쓰던 내용은 그대로 두었어요. {hasEmptySlot ? "비어 있는 다른 봉투에 이어서 저장할 수 있어요." : "지금은 비어 있는 봉투가 없어요."}</p>
            {hasEmptySlot && (
              <button
                type="button"
                onClick={onMoveToEmptySlot}
                className="mt-3 min-h-11 rounded-full bg-sage px-5 text-sm font-semibold text-white"
              >
                빈 봉투에 이어서 쓰기
              </button>
            )}
          </div>
        )}

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="nickname" className="text-sm font-semibold">
              닉네임
            </label>
            <span className={`text-xs ${nicknameLength > NICKNAME_MAX ? "font-semibold text-danger" : ""}`}>
              {nicknameLength}/{NICKNAME_MAX}
            </span>
          </div>
          <input
            id="nickname"
            type="text"
            autoComplete="off"
            enterKeyHint="next"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setErrors((prev) => ({ ...prev, nickname: undefined }));
            }}
            aria-invalid={errors.nickname ? true : undefined}
            aria-describedby={errors.nickname ? "nickname-error" : undefined}
            placeholder="예: 막내 민수"
            className={`${fieldClass} mt-1.5 h-12 text-base`}
          />
          {errors.nickname && (
            <p id="nickname-error" role="alert" className="mt-1.5 text-sm font-medium text-danger">
              {errors.nickname}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="content" className="text-sm font-semibold">
              편지 내용
            </label>
            <span className={`text-xs ${contentLength > CONTENT_MAX ? "font-semibold text-danger" : ""}`}>
              {contentLength.toLocaleString("ko-KR")}/{CONTENT_MAX.toLocaleString("ko-KR")}
            </span>
          </div>
          <div
            className={`mt-1.5 rounded-2xl border-2 bg-white/50 px-4 py-3 focus-within:border-sage ${
              errors.content ? "border-danger" : "border-brown/50"
            }`}
          >
            <textarea
              id="content"
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setErrors((prev) => ({ ...prev, content: undefined }));
              }}
              aria-invalid={errors.content ? true : undefined}
              aria-describedby={errors.content ? "content-error" : undefined}
              placeholder="팀장님께 전하고 싶은 마음을 적어 주세요."
              className="letter-lines block w-full resize-none overflow-hidden bg-transparent p-0 outline-none"
            />
          </div>
          {errors.content && (
            <p id="content-error" role="alert" className="mt-1.5 text-sm font-medium text-danger">
              {errors.content}
            </p>
          )}
        </div>

        {mode === "create" ? (
          <div>
            <label htmlFor="password" className="text-sm font-semibold">
              비밀번호 (숫자 4자리)
            </label>
            <input
              id="password"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="off"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value.replace(/\D/g, "").slice(0, 4));
                setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby="password-help"
              className={`${fieldClass} mt-1.5 h-12 text-center text-xl tracking-[0.6em]`}
            />
            <p id="password-help" className={`mt-1.5 text-sm ${errors.password ? "font-medium text-danger" : ""}`} role={errors.password ? "alert" : undefined}>
              {errors.password ?? "나중에 편지를 고치거나 지울 때 필요해요. 꼭 기억해 주세요."}
            </p>
          </div>
        ) : (
          <p className="text-sm">비밀번호는 바꿀 수 없어요.</p>
        )}

        {submitError && (
          <p role="alert" className="rounded-2xl bg-danger/10 p-3 text-[15px] font-medium text-danger">
            {submitError}
          </p>
        )}
      </form>
    </LetterFullscreen>
  );
}
