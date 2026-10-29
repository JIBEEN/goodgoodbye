"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-hand text-3xl">앗, 문제가 생겼어요</p>
      <p className="text-base">잠시 후 다시 시도해 주세요.</p>
      <button onClick={reset} className="min-h-11 rounded-full bg-sage px-6 font-medium text-white">
        다시 시도
      </button>
    </main>
  );
}
