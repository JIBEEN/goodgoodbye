"use client";

import { useEffect } from "react";
import { motion } from "motion/react";

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "success" | "error";
}

const TONE: Record<Toast["tone"], string> = {
  info: "bg-ink text-paper",
  success: "bg-sage text-white",
  error: "bg-danger text-white",
};

export default function ToastMessage({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3200);
    return () => clearTimeout(timer);
  }, [toast.id, onDone]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] mx-auto flex max-w-[430px] justify-center px-5 safe-bottom">
      <motion.p
        role="status"
        aria-live="polite"
        className={`rounded-2xl px-4 py-3 text-center text-[15px] font-medium shadow-lg ${TONE[toast.tone]}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.25 }}
      >
        {toast.text}
      </motion.p>
    </div>
  );
}
