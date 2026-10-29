"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";

// 편지지가 겹쳐 열려도(닫히는 중 + 열리는 중) 스크롤 잠금이 일찍 풀리지 않도록 센다.
let lockCount = 0;
function useScrollLock() {
  useEffect(() => {
    const html = document.documentElement;
    if (lockCount++ === 0) {
      html.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (--lockCount === 0) {
        html.style.overflow = "";
        document.body.style.overflow = "";
      }
    };
  }, []);
}

/** 모바일 키보드가 올라오면 보이는 영역(visual viewport)에 맞춰 편지지 크기를 줄인다. */
function useVisibleArea() {
  const [area, setArea] = useState<{ height: number; top: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setArea({ height: vv.height, top: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return area;
}

interface Props {
  label: string;
  heading?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

export default function LetterFullscreen({ label, heading, onClose, footer, children }: Props) {
  useScrollLock();
  const area = useVisibleArea();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className="fixed inset-x-0 z-40 mx-auto flex max-w-[430px] flex-col bg-paper outline-none"
      style={{ top: area?.top ?? 0, height: area ? `${area.height}px` : "100dvh" }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="safe-top shrink-0">
        <div className="flex min-h-14 items-center justify-between gap-3 px-5">
          <div className="min-w-0 flex-1 truncate font-hand text-[28px] leading-none">{heading}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-envelope/60"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-1">{children}</div>

      {footer && (
        <div className="shrink-0 border-t border-brown/30 bg-paper safe-bottom">
          <div className="flex gap-3 px-5 py-3">{footer}</div>
        </div>
      )}
    </motion.div>
  );
}
