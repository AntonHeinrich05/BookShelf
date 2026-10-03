import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Pause, Play, StickyNote, Sun, X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useAddSession, useBook } from "@/hooks/useBooks";
import { useReadingTimer } from "@/context/ReadingTimerContext";
import { useKeyboardViewport } from "@/hooks/useKeyboardViewport";
import { errorMessage } from "@/lib/api";
import { formatClock, formatDuration, remainingSeconds } from "@/lib/constants";
import { Cover, paletteFor } from "@/components/books/Cover";
import { ProgressRing } from "@/components/books/ProgressRing";
import { PillButton } from "@/components/ios/Form";
import { Splash } from "@/components/layout/Splash";
import { cn } from "@/lib/utils";

/** Bildschirm während des Lesens anlassen (Wake Lock, wenn der Browser es kann). */
function useWakeLock(enabled) {
  const lock = useRef(null);
  useEffect(() => {
    if (!enabled || !navigator.wakeLock) return;
    let active = true;
    const request = async () => {
      try {
        lock.current = await navigator.wakeLock.request("screen");
      } catch {
        /* nicht verfügbar – Timer läuft trotzdem weiter (Date.now) */
      }
    };
    request();
    const onVisible = () => active && document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      lock.current?.release?.();
      lock.current = null;
    };
  }, [enabled]);
}

export default function ReadingTimerPage() {
  useKeyboardViewport();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: book } = useBook(id);
  const { timer, elapsed, running, start, pause, resume, clear } = useReadingTimer();
  const addSession = useAddSession();
  const [ending, setEnding] = useState(false);
  const [page, setPage] = useState(0);
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [keepAwake, setKeepAwake] = useState(() => localStorage.getItem("bs_wake") !== "0");
  useWakeLock(keepAwake && running);

  useEffect(() => {
    if (book && timer?.bookId !== id) start(book); // Direktaufruf der Seite → Timer starten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id]);
  useEffect(() => { if (book) setPage(book.current_page || 0); }, [book]);

  if (!book) return <div className="min-h-full bg-canvas"><Splash /></div>;
  const active = timer?.bookId === id;
  const seconds = active ? elapsed : 0;
  const remaining = Math.max(0, remainingSeconds(book) - seconds);
  const max = book.page_count || 100;
  const [bgA, bgB] = paletteFor(book.title);
  const pagesThisSession = Math.max(0, page - (timer?.startPage || 0));

  const finishSession = async () => {
    pause();
    try {
      const res = await addSession.mutateAsync({ bookId: id, data: { seconds, started_at: timer?.startedAt, page_from: timer?.startPage, page_to: book.page_count ? page : null, note: note || null } });
      clear();
      toast.success(`${formatDuration(seconds)} Lesezeit gespeichert`);
      const finished = res?.book?.status === "finished" || (book.page_count && page >= book.page_count);
      // Fertig gelesen → Leseprotokoll (Bewertung, Daten) öffnet sich automatisch
      navigate(`/books/${id}`, { replace: true, state: finished ? { openFinish: true } : undefined });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const discard = () => { clear(); navigate(-1); };
  const toggleAwake = () => { const next = !keepAwake; setKeepAwake(next); localStorage.setItem("bs_wake", next ? "1" : "0"); toast(next ? "Bildschirm bleibt beim Lesen an" : "Bildschirm darf sich ausschalten – der Timer läuft weiter"); };

  return (
    <div className="relative min-h-full overflow-hidden bg-canvas text-white" data-testid="reading-timer-page">
      {/* Hintergrund: weich verwischtes Cover (bewusst) – das eigentliche Cover bleibt scharf */}
      {book.cover_url ? <div className="timer-bg" style={{ backgroundImage: `url(${book.cover_url})` }} /> : <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${bgA}, ${bgB})` }} />}
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative flex min-h-[100dvh] flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate(-1)} className="grid h-11 w-11 place-items-center rounded-full bg-black/40 backdrop-blur" aria-label="Zurück" data-testid="timer-close"><X size={22} /></button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleAwake} className={cn("grid h-11 w-11 place-items-center rounded-full backdrop-blur", keepAwake ? "bg-white/25" : "bg-black/40 text-white/60")} aria-label="Bildschirm anlassen" data-testid="timer-wake"><Sun size={20} /></button>
            <button type="button" onClick={() => setEnding(true)} className="rounded-full bg-black/40 px-5 py-2.5 font-display text-base font-semibold backdrop-blur" data-testid="timer-end">Beenden</button>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-7">
          <div className="relative">
            <Cover src={book.cover_url} title={book.title} author={book.authors?.[0]} large className="w-48 shadow-[0_30px_60px_rgba(0,0,0,0.55)] sm:w-56" rounded="rounded-2xl" />
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-xs font-semibold backdrop-blur" data-testid="timer-progress-badge">
              {book.page_count ? `S. ${book.current_page || 0} von ${book.page_count}` : `${book.progress_percent || 0} %`}
            </span>
          </div>
          <div className="text-center">
            <p className="line-clamp-1 px-4 font-display text-base font-semibold text-white/90">{book.title}</p>
            <p className="tabular mt-3 font-display text-[84px] font-extrabold leading-none tracking-tight" data-testid="timer-clock">{formatClock(seconds)}</p>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-white/70" data-testid="timer-remaining">
              <span className={cn("inline-block h-2 w-2 rounded-full", running ? "animate-pulse bg-emerald-400" : "bg-white/40")} />
              {running ? "Läuft" : "Pausiert"}{book.estimated_seconds ? ` · noch ca. ${formatDuration(remaining)}` : ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 items-end gap-4 pb-2">
          <button type="button" onClick={() => setNoteOpen(true)} className="flex flex-col items-center gap-2" data-testid="timer-note">
            <span className={cn("grid h-16 w-16 place-items-center rounded-full backdrop-blur", note ? "bg-white/35" : "bg-white/20")}><StickyNote size={24} /></span>
            <span className="text-xs">Notiz</span>
          </button>
          <button type="button" onClick={() => (running ? pause() : active ? resume() : start(book))} className="flex flex-col items-center gap-2" data-testid="timer-toggle">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-transform active:scale-95">
              {running ? <Pause size={32} className="fill-current" /> : <Play size={32} className="ml-1 fill-current" />}
            </span>
            <span className="text-xs">{running ? "Pause" : "Weiter"}</span>
          </button>
          <button type="button" onClick={discard} className="flex flex-col items-center gap-2" data-testid="timer-discard">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/20 backdrop-blur"><X size={24} /></span>
            <span className="text-xs">Verwerfen</span>
          </button>
        </div>
      </div>

      {/* Beenden → Seite eintragen */}
      <Drawer open={ending} onOpenChange={setEnding} repositionInputs={false}>
        <DrawerContent className="h-sheet border-line bg-canvas text-fg outline-none" data-testid="end-session-sheet">
          <DrawerTitle className="sr-only">Lese-Session beenden</DrawerTitle>
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <h2 className="mt-1 font-display text-lg font-semibold">Wo bist du stehen geblieben?</h2>
            <p className="mt-1 text-sm text-fg2">{formatDuration(seconds)} gelesen{pagesThisSession > 0 ? ` · ${pagesThisSession} Seiten` : ""}</p>
            <div className="my-5">
              <ProgressRing value={page} max={max} size={Math.min(260, window.innerWidth - 110)} stroke={22} onChange={setPage} testId="end-ring">
                <span className="font-display text-5xl font-extrabold tabular-nums leading-none" data-testid="end-pages">{page}</span>
                <span className="mt-2 text-sm text-fg2">von {max} {book.page_count ? "Seiten" : "%"}</span>
              </ProgressRing>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} className="grid h-11 w-11 place-items-center rounded-full bg-surface text-lg font-semibold" aria-label="Eine Seite zurück" data-testid="end-page-minus">−</button>
              <input type="number" inputMode="numeric" min={0} max={max} value={page} onFocus={(e) => e.target.select()} onChange={(e) => setPage(Math.min(max, Math.max(0, Number(e.target.value))))} className="w-28 rounded-xl bg-surface px-3 py-2.5 text-center text-[18px] tabular-nums outline-none" data-testid="end-page-input" />
              <button type="button" onClick={() => setPage((p) => Math.min(max, p + 1))} className="grid h-11 w-11 place-items-center rounded-full bg-surface text-lg font-semibold" aria-label="Eine Seite weiter" data-testid="end-page-plus">+</button>
            </div>
            {book.page_count > 0 && page < max && (
              <button type="button" onClick={() => setPage(max)} className="mt-3 text-sm font-medium text-tint" data-testid="end-mark-finished">Buch fertig gelesen</button>
            )}
            <div className="mt-5 w-full max-w-md space-y-2">
              <PillButton onClick={finishSession} disabled={addSession.isPending} data-testid="end-save"><Check size={18} className="mr-2" /> {page >= max && book.page_count ? "Speichern & bewerten" : "Speichern"}</PillButton>
              <button type="button" onClick={() => setEnding(false)} className="w-full py-3 text-sm font-medium text-fg2">Weiterlesen</button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={noteOpen} onOpenChange={setNoteOpen} repositionInputs={false}>
        <DrawerContent className="max-h-[calc(80dvh-var(--kb))] border-line bg-canvas text-fg outline-none" data-testid="note-sheet">
          <DrawerTitle className="px-4 pt-2 font-display text-lg">Notiz zur Session</DrawerTitle>
          <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Gedanken, Zitat, Lieblingsstelle…" className="mt-3 w-full resize-none rounded-2xl bg-surface px-4 py-3 text-[16px] outline-none placeholder:text-fg3" data-testid="note-input" />
            <PillButton onClick={() => setNoteOpen(false)} className="mt-3">Fertig</PillButton>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
