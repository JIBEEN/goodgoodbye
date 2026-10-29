"use client";

import { motion } from "motion/react";

/** 봉투 투명도의 영향을 받지 않도록 봉투와 별도 레이어로 그린다. */
export default function HeartSeal() {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[54%] block w-[27%] -translate-x-1/2 -translate-y-1/2"
      initial={{ scale: 0, rotate: -25, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 16 }}
    >
      <svg viewBox="0 0 40 40" className="block h-auto w-full drop-shadow-[0_2px_2px_rgba(107,81,71,0.35)]">
        <circle cx="20" cy="20" r="18" fill="#CA8290" />
        <circle cx="20" cy="20" r="14.5" fill="none" stroke="#B96F7E" strokeWidth="1" />
        <path
          d="M20 29 C9 21 11 12 16.5 12.5 C18.5 12.7 19.6 14 20 15 C20.4 14 21.5 12.7 23.5 12.5 C29 12 31 21 20 29Z"
          fill="#F8F1E5"
        />
      </svg>
    </motion.span>
  );
}
