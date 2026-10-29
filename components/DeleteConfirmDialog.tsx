"use client";

import DialogShell from "./DialogShell";

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmDialog({ onConfirm, onCancel }: Props) {
  return (
    <DialogShell title="편지를 삭제할까요?" onCancel={onCancel}>
      <p className="mt-2 text-[15px] leading-relaxed">
        정말 이 편지를 삭제하시겠어요?
        <br />
        삭제한 편지는 복구할 수 없습니다.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          autoFocus
          className="min-h-12 flex-1 rounded-full border border-brown bg-transparent text-base font-semibold"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-12 flex-1 rounded-full bg-danger text-base font-semibold text-white"
        >
          편지 삭제
        </button>
      </div>
    </DialogShell>
  );
}
