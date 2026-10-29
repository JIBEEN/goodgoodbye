"use client";

import { motion } from "motion/react";
import HeartSeal from "./HeartSeal";
import type { EnvelopePlacement } from "@/lib/layout/envelopes";

interface Props {
  slot: number;
  nickname: string | null; // null = 빈 봉투(EMPTY)
  placement: EnvelopePlacement;
  onSelect: () => void;
}

export default function Envelope({ slot, nickname, placement, onSelect }: Props) {
  const filled = nickname !== null;
  return (
    <div
      className="absolute"
      style={{
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: "min(30%, 140px)",
        transform: `translate(-50%, -50%) rotate(${placement.rotate}deg)`,
      }}
    >
      <motion.button
        type="button"
        onClick={onSelect}
        whileTap={{ scale: 0.93 }}
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.25 }}
        aria-label={filled ? `${slot}번 봉투, ${nickname}님의 편지 열기` : `${slot}번 봉투, 아직 비어 있어요`}
        className="relative block aspect-[3/2] w-full min-h-11 min-w-11 cursor-pointer rounded-md"
      >
        {/* 봉투 그림만 투명도 0.6(= 투명도 40%). 하트 스티커는 형제 레이어라 영향을 받지 않는다. */}
        <svg
          viewBox="0 0 150 100"
          aria-hidden
          className="absolute inset-0 h-full w-full opacity-60"
          style={{ filter: "drop-shadow(0 4px 6px rgba(107, 81, 71, 0.3))" }}
        >
          <rect x="1" y="1" width="148" height="98" rx="6" fill="#E8D4BB" stroke="#B98D71" strokeOpacity="0.55" />
          <path d="M2 98 L58 48 M148 98 L92 48" stroke="#B98D71" strokeOpacity="0.4" strokeWidth="1.2" fill="none" />
          <path
            d="M2 4 L75 58 L148 4 Z"
            fill="#DFC7A9"
            stroke="#B98D71"
            strokeOpacity="0.6"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        {filled && <HeartSeal />}
      </motion.button>
    </div>
  );
}
