"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { motion } from "motion/react";

interface Props {
  title: string;
  onCancel: () => void;
  children: ReactNode;
}

/** 비밀번호·삭제 확인 같은 작은 대화상자의 공통 틀 */
export default function DialogShell({ title, onCancel, children }: Props) {
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  useEffect(() => {
    // 입력창이 있으면 그쪽이 autoFocus로 포커스를 가져간다. 없으면 대화상자 자체로.
    if (!cardRef.current?.contains(document.activeElement)) cardRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/45 px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-[360px] rounded-3xl bg-paper p-6 shadow-2xl outline-none"
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25 }}
      >
        <h2 id={titleId} className="font-hand text-[28px] leading-tight">
          {title}
        </h2>
        {children}
      </motion.div>
    </motion.div>
  );
}
