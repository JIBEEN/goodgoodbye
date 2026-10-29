"use client";

export default function ModeSwitchButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 shrink-0 rounded-full border border-brown bg-paper px-3.5 text-sm font-semibold text-ink shadow-sm active:scale-95"
    >
      {label}
    </button>
  );
}
