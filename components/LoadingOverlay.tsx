"use client";

import { motion } from "motion/react";

export default function LoadingOverlay({ label }: { label: string }) {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-paper/70 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <span className="h-9 w-9 animate-spin rounded-full border-4 border-envelope border-t-heart" aria-hidden />
      <p className="text-base font-medium">{label}</p>
    </motion.div>
  );
}
