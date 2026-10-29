"use client";

import { useMemo } from "react";
import Envelope from "./Envelope";
import { placeEnvelopes } from "@/lib/layout/envelopes";
import { SLOT_COUNT, type Letter } from "@/lib/types";

interface Props {
  letters: Letter[];
  layoutSeed: string;
  onSelect: (slot: number) => void;
}

export default function LetterBoard({ letters, layoutSeed, onSelect }: Props) {
  const placements = useMemo(() => placeEnvelopes(layoutSeed), [layoutSeed]);
  const bySlot = useMemo(() => new Map(letters.map((l) => [l.slot_number, l])), [letters]);

  return (
    <div role="group" aria-label="편지봉투 5개" className="relative min-h-[500px] flex-1">
      {Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).map((slot) => (
        <Envelope
          key={slot}
          slot={slot}
          nickname={bySlot.get(slot)?.nickname ?? null}
          placement={placements[slot - 1]}
          onSelect={() => onSelect(slot)}
        />
      ))}
    </div>
  );
}
