"use client";

import LetterFullscreen from "./LetterFullscreen";
import type { Letter } from "@/lib/types";

interface Props {
  letter: Letter;
  /** 편집모드에서만 true. 완성본에서는 수정·삭제 버튼 자체를 그리지 않는다. */
  editable: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function LetterReader({ letter, editable, onClose, onEdit, onDelete }: Props) {
  return (
    <LetterFullscreen
      label={`${letter.nickname}님의 편지`}
      heading={<>From. {letter.nickname}</>}
      onClose={onClose}
      footer={
        editable ? (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="min-h-12 flex-1 rounded-full bg-sage text-base font-semibold text-white"
            >
              수정하기
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="min-h-12 flex-1 rounded-full border border-danger text-base font-semibold text-danger"
            >
              삭제하기
            </button>
          </>
        ) : undefined
      }
    >
      {/* React가 텍스트를 이스케이프하므로 편지 내용이 HTML/스크립트로 실행되지 않는다. */}
      <p className="letter-lines whitespace-pre-wrap break-words">{letter.content}</p>
    </LetterFullscreen>
  );
}
