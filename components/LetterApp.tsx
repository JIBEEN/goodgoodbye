"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig } from "motion/react";
import BackgroundUpload from "./BackgroundUpload";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import LetterBoard from "./LetterBoard";
import LetterEditor, { type EditorValues } from "./LetterEditor";
import LetterReader from "./LetterReader";
import LoadingOverlay from "./LoadingOverlay";
import ModeSwitchButton from "./ModeSwitchButton";
import PasswordDialog from "./PasswordDialog";
import ToastMessage, { type Toast } from "./ToastMessage";
import {
  ApiError,
  createLetter,
  deleteLetter,
  fetchLetters,
  fetchProject,
  updateLetter,
  verifyLetter,
} from "@/lib/client/api";
import { SLOT_COUNT, type Letter, type ProjectPublic, type VerifyAction } from "@/lib/types";

type Screen =
  | { kind: "board" }
  | { kind: "compose"; slot: number }
  | { kind: "read"; slot: number }
  | { kind: "verify"; slot: number; action: VerifyAction }
  | { kind: "edit"; slot: number; token: string; reauth?: boolean }
  | { kind: "confirmDelete"; slot: number; token: string };

const FROM_EDIT_KEY = "gg:from-edit";
const MSG_GENERIC = "일시적인 오류가 생겼어요. 잠시 후 다시 시도해 주세요.";

const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : MSG_GENERIC);

function upsert(list: Letter[], letter: Letter): Letter[] {
  return [...list.filter((l) => l.slot_number !== letter.slot_number), letter].sort(
    (a, b) => a.slot_number - b.slot_number,
  );
}

export default function LetterApp({ mode }: { mode: "edit" | "view" }) {
  const router = useRouter();
  const editable = mode === "edit";

  const [project, setProject] = useState<ProjectPublic | null>(null);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [screen, setScreen] = useState<Screen>({ kind: "board" });
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [canReturnToEdit, setCanReturnToEdit] = useState(false);

  // 늦게 도착한 오래된 조회 결과가 최신 저장 결과를 덮어쓰지 않도록 순번을 매긴다.
  const fetchSeq = useRef(0);
  const toastId = useRef(0);

  const bySlot = useMemo(() => new Map(letters.map((l) => [l.slot_number, l])), [letters]);
  const emptySlots = useMemo(
    () => Array.from({ length: SLOT_COUNT }, (_, i) => i + 1).filter((s) => !bySlot.has(s)),
    [bySlot],
  );

  const showToast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    setToast({ id: ++toastId.current, text, tone });
  }, []);
  const clearToast = useCallback(() => setToast(null), []);

  const refreshLetters = useCallback(async (): Promise<Letter[] | null> => {
    const seq = ++fetchSeq.current;
    try {
      const fresh = await fetchLetters();
      if (seq !== fetchSeq.current) return null;
      setLetters(fresh);
      return fresh;
    } catch {
      return null;
    }
  }, []);

  const loadAll = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setPhase("loading");
    try {
      const [p, l] = await Promise.all([fetchProject(), fetchLetters()]);
      if (seq !== fetchSeq.current) return;
      setProject(p);
      setLetters(l);
      setPhase("ready");
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      setLoadError(errorMessage(err));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // 미리보기에서 "편집으로 돌아가기"는 편집 화면에서 넘어온 같은 탭에만 보여 준다.
  useEffect(() => {
    try {
      setCanReturnToEdit(!editable && sessionStorage.getItem(FROM_EDIT_KEY) === "1");
    } catch {
      setCanReturnToEdit(false);
    }
  }, [editable]);

  // 앱으로 돌아왔을 때만 조용히 최신 상태를 맞춘다.
  useEffect(() => {
    if (phase !== "ready") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshLetters();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [phase, refreshLetters]);

  // 열어 둔 편지가 다른 곳에서 삭제되었다면 보드로 돌려보낸다.
  const screenSlot = screen.kind === "board" ? null : screen.slot;
  useEffect(() => {
    if (phase !== "ready" || screenSlot === null || screen.kind === "compose") return;
    if (!bySlot.has(screenSlot)) {
      setScreen({ kind: "board" });
      showToast("이 편지는 삭제되었어요.");
    }
  }, [phase, screen.kind, screenSlot, bySlot, showToast]);

  async function withBusy<T>(label: string, task: () => Promise<T>): Promise<T> {
    setBusy(label);
    try {
      return await task();
    } finally {
      setBusy(null);
    }
  }

  function selectSlot(slot: number) {
    if (bySlot.has(slot)) setScreen({ kind: "read", slot });
    else if (editable) setScreen({ kind: "compose", slot });
    else showToast("아직 편지가 도착하지 않았어요.");
  }

  async function handleCreate(slot: number, values: EditorValues): Promise<{ error?: string }> {
    try {
      const letter = await withBusy("편지를 봉투에 담는 중이에요…", () =>
        createLetter({ slot_number: slot, ...values }),
      );
      fetchSeq.current++;
      setLetters((prev) => upsert(prev, letter));
      setScreen({ kind: "board" });
      showToast("편지가 봉투에 담겼어요 💌", "success");
      return {};
    } catch (err) {
      await refreshLetters(); // 서버의 실제 저장 상태를 다시 확인한다
      return { error: errorMessage(err) };
    }
  }

  async function handleUpdate(
    letter: Letter,
    token: string,
    values: EditorValues,
  ): Promise<{ error?: string }> {
    try {
      const updated = await withBusy("편지를 저장하는 중이에요…", () =>
        updateLetter(letter.id, token, {
          nickname: values.nickname,
          content: values.content,
          updated_at: letter.updated_at,
        }),
      );
      fetchSeq.current++;
      setLetters((prev) => upsert(prev, updated));
      setScreen({ kind: "read", slot: letter.slot_number });
      showToast("편지를 수정했어요", "success");
      void refreshLetters();
      return {};
    } catch (err) {
      await refreshLetters();
      if (err instanceof ApiError && err.status === 403) {
        // 인증이 만료됨: 쓰던 내용은 그대로 두고 비밀번호만 다시 받는다.
        setScreen({ kind: "edit", slot: letter.slot_number, token, reauth: true });
        return { error: "인증이 만료되었어요. 비밀번호를 다시 확인해 주세요." };
      }
      return { error: errorMessage(err) };
    }
  }

  async function handleVerify(letter: Letter, action: VerifyAction, password: string) {
    const token = await withBusy("확인하는 중이에요…", () => verifyLetter(letter.id, password, action));
    setScreen(
      action === "edit"
        ? { kind: "edit", slot: letter.slot_number, token }
        : { kind: "confirmDelete", slot: letter.slot_number, token },
    );
  }

  async function handleReauth(letter: Letter, password: string) {
    const token = await withBusy("확인하는 중이에요…", () => verifyLetter(letter.id, password, "edit"));
    setScreen({ kind: "edit", slot: letter.slot_number, token });
    showToast("확인되었어요. 다시 저장해 주세요.", "success");
  }

  async function handleDelete(letter: Letter, token: string) {
    try {
      await withBusy("편지를 삭제하는 중이에요…", () => deleteLetter(letter.id, token));
      fetchSeq.current++;
      setLetters((prev) => prev.filter((l) => l.id !== letter.id));
      setScreen({ kind: "board" });
      showToast("편지를 삭제했어요. 이 봉투는 다시 쓸 수 있어요.", "success");
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      await refreshLetters();
      if (status === 403) {
        setScreen({ kind: "verify", slot: letter.slot_number, action: "delete" });
        showToast("인증이 만료되었어요. 비밀번호를 다시 입력해 주세요.", "error");
      } else if (status === 404) {
        setScreen({ kind: "board" });
        showToast("이미 삭제된 편지예요.");
      } else {
        showToast(errorMessage(err), "error");
      }
    }
  }

  function goToPreview() {
    try {
      sessionStorage.setItem(FROM_EDIT_KEY, "1");
    } catch {
      /* 저장소를 못 쓰는 환경이면 돌아가기 버튼만 생략된다 */
    }
    router.push("/view");
  }

  // ----- 화면 -----

  if (phase === "loading") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[430px] items-center justify-center">
        <LoadingOverlay label="편지봉투를 가져오는 중이에요…" />
      </main>
    );
  }

  if (phase === "error" || !project) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-hand text-3xl">불러오지 못했어요</p>
        <p role="alert" className="text-base">
          {loadError || MSG_GENERIC}
        </p>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="min-h-11 rounded-full bg-sage px-6 text-base font-semibold text-white"
        >
          다시 시도
        </button>
      </main>
    );
  }

  // 배경 사진은 서버 기준으로 아직 없을 때만 올릴 수 있다 (편집모드 전용).
  if (editable && !project.background_locked) {
    return <BackgroundUpload onDone={() => void loadAll()} />;
  }

  const current = screenSlot !== null ? bySlot.get(screenSlot) : undefined;
  const filledCount = letters.length;

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative mx-auto flex min-h-dvh max-w-[430px] flex-col overflow-hidden bg-paper">
        {project.background_image_url && (
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${project.background_image_url}")` }}
          />
        )}
        <div aria-hidden className="absolute inset-0 bg-paper/45" />

        <header className="safe-top relative z-10 bg-paper/75 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5">
            <div className="min-w-0">
              <h1 className="font-hand text-[28px] leading-tight">{project.title}</h1>
              {!editable && (
                <p className="text-[13px] leading-snug">함께한 시간에 감사하며, 팀원들이 마음을 담아 보낸 편지예요.</p>
              )}
            </div>
            {editable ? (
              <ModeSwitchButton label="완성본 미리보기" onClick={goToPreview} />
            ) : (
              canReturnToEdit && <ModeSwitchButton label="편집으로 돌아가기" onClick={() => router.push("/edit")} />
            )}
          </div>
        </header>

        <LetterBoard letters={letters} layoutSeed={project.layout_seed} onSelect={selectSlot} />

        <footer className="safe-bottom relative z-10 bg-paper/75 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <p>{editable ? "봉투를 눌러 편지를 쓰거나 읽어 보세요." : "봉투를 눌러 편지를 읽어 보세요."}</p>
            <p className="shrink-0 font-semibold" aria-label={`${SLOT_COUNT}개 중 ${filledCount}개 작성 완료`}>
              {filledCount}/{SLOT_COUNT}
            </p>
          </div>
        </footer>
      </div>

      <AnimatePresence>
        {screen.kind === "compose" && (
          <LetterEditor
            key="editor"
            mode="create"
            initial={{ nickname: "", content: "", password: "" }}
            onSubmit={(values) => handleCreate(screen.slot, values)}
            onClose={() => setScreen({ kind: "board" })}
            slotTaken={bySlot.has(screen.slot)}
            hasEmptySlot={emptySlots.length > 0}
            onMoveToEmptySlot={() => emptySlots[0] && setScreen({ kind: "compose", slot: emptySlots[0] })}
          />
        )}

        {screen.kind === "edit" && current && (
          <LetterEditor
            key="editor"
            mode="edit"
            initial={{ nickname: current.nickname, content: current.content, password: "" }}
            onSubmit={(values) => handleUpdate(current, screen.token, values)}
            onClose={() => setScreen({ kind: "read", slot: current.slot_number })}
          />
        )}

        {(screen.kind === "read" || screen.kind === "verify" || screen.kind === "confirmDelete") && current && (
          <LetterReader
            key="reader"
            letter={current}
            editable={editable}
            onClose={() => setScreen({ kind: "board" })}
            onEdit={() => setScreen({ kind: "verify", slot: current.slot_number, action: "edit" })}
            onDelete={() => setScreen({ kind: "verify", slot: current.slot_number, action: "delete" })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {screen.kind === "verify" && current && (
          <PasswordDialog
            key="verify"
            action={screen.action}
            onSubmit={(pw) => handleVerify(current, screen.action, pw)}
            onCancel={() => setScreen({ kind: "read", slot: current.slot_number })}
          />
        )}
        {screen.kind === "edit" && screen.reauth && current && (
          <PasswordDialog
            key="reauth"
            action="edit"
            onSubmit={(pw) => handleReauth(current, pw)}
            onCancel={() => setScreen({ kind: "read", slot: current.slot_number })}
          />
        )}
        {screen.kind === "confirmDelete" && current && (
          <DeleteConfirmDialog
            key="confirm"
            onConfirm={() => void handleDelete(current, screen.token)}
            onCancel={() => setScreen({ kind: "read", slot: current.slot_number })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{busy && <LoadingOverlay key="busy" label={busy} />}</AnimatePresence>
      <AnimatePresence>{toast && <ToastMessage key={toast.id} toast={toast} onDone={clearToast} />}</AnimatePresence>
    </MotionConfig>
  );
}
