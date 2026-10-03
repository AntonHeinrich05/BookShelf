import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Pause, Play, StickyNote, X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useAddSession, useBook } from "@/hooks/useBooks";
import { useReadingTimer } from "@/context/ReadingTimerContext";
import { useKeyboardViewport } from "@/hooks/useKeyboardViewport";
import { errorMessage } from "@/lib/api";
import { formatClock, formatDuration, remainingSeconds } from "@/lib/constants";
import { Cover } from "@/components/books/Cover";
import { ProgressRing } from "@/components/books/ProgressRing";
import { PillButton } from "@/components/ios/Form";
import { Splash } from "@/components/layout/Splash";

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

  const finishSession = async () => {
    pause();
    try {
      const res = await addSession.mutateAsync({ bookId: id, data: { seconds, started_at: timer?.startedAt, page_from: timer?.startPage, page_to: book.page_count ? page : null, note: note || null } });
      clear();
      toast.success(`${formatDuration(seconds)} Lesezeit gespeichert`);
      navigate(`/books/${id}`, { replace: true });
      if (res?.book?.status === "finished") toast.success("Buch fertig gelesen!");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const discard = () => { clear(); navigate(-1); };

  return (
    <div className="relative min-h-full overflow-hidden bg-canvas text-white" data-testid="reading-timer-page">
      {book.cover_url ? <div className="timer-bg" style={{ backgroundImage: `url(${book.cover_url})` }} /> : <div className="absolute inset-0 bg-gradient-to-b from-surface2 to-canvas" />}
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative flex min-h-[100dvh] flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate(-1)} className="grid h-12 w-12 place-items-center rounded-full bg-black/40 backdrop-blur" aria-label="Zurück" data-testid="timer-close"><X size={24} /></button>
          <button type="button" onClick={() => setEnding(true)} className="rounded-full bg-black/40 px-6 py-3 font-display text-lg font-semibold backdrop-blur" data-testid="timer-end">Beenden</button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <div className="relative">
            <Cover src={book.cover_url} title={book.title} className="w-56 shadow-[0_30px_60px_rgba(0,0,0,0.5)] sm:w-64" rounded="rounded-2xl" />
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold backdrop-blur">Ab {book.progress_percent || 0}%</span>
          </div>
          <div className="text-center">
            <p className="flex items-center justify-center gap-2 text-lg text-white/80" data-testid="timer-remaining">
              <span className="inline-block h-5 w-5 rounded-full border-2 border-white/60" />
              {book.estimated_seconds ? `${formatDuration(remaining)} bis zum Ziel` : book.title}
            </p>
            <p className="tabular mt-2 font-display text-[88px] font-extrabold leading-none tracking-tight" data-testid="timer-clock">{formatClock(seconds)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 items-end gap-4 pb-4">
          <button type="button" onClick={() => setNoteOpen(true)} className="flex flex-col items-center gap-3" data-testid="timer-note">
            <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-white/20 backdrop-blur"><StickyNote size={26} /></span>
            <span className="text-sm">Notiz</span>
          </button>
          <button type="button" onClick={() => (running ? pause() : active ? resume() : start(book))} className="flex flex-col items-center gap-3" data-testid="timer-toggle">
            <span className="grid h-[88px] w-[88px] place-items-center rounded-full bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-transform active:scale-95">
              {running ? <Pause size={34} className="fill-current" /> : <Play size={34} className="ml-1 fill-current" />}
            </span>
            <span className="text-sm">{running ? "Pause" : "Abspielen"}</span>
          </button>
          <button type="button" onClick={discard} className="flex flex-col items-center gap-3" data-testid="timer-discard">
            <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-white/20 backdrop-blur"><X size={26} /></span>
            <span className="text-sm">Verwerfen</span>
          </button>
        </div>
      </div>

      {/* Beenden → Seite eintragen */}
      <Drawer open={ending} onOpenChange={setEnding} repositionInputs={false}>
        <DrawerContent className="h-sheet border-line bg-canvas text-fg outline-none" data-testid="end-session-sheet">
          <DrawerTitle className="sr-only">Lese-Session beenden</DrawerTitle>
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <h2 className="mt-2 font-display text-lg font-semibold">Wo bist du stehen geblieben?</h2>
            <p className="mt-1 text-sm text-fg2">{formatDuration(seconds)} gelesen</p>
            <div className="my-6">
              <ProgressRing value={page} max={max} size={Math.min(280, window.innerWidth - 96)} onChange={setPage} testId="end-ring">
                <span className="font-display text-6xl font-extrabold tabular-nums leading-none" data-testid="end-pages">{page}</span>
                <span className="mt-2 text-sm text-fg2">von {max} {book.page_count ? "Seiten" : "%"}</span>
              </ProgressRing>
            </div>
            <input type="number" inputMode="numeric" min={0} max={max} value={page} onFocus={(e) => e.target.select()} onChange={(e) => setPage(Math.min(max, Math.max(0, Number(e.target.value))))} className="w-28 rounded-xl bg-surface px-3 py-2 text-center text-[18px] tabular-nums outline-none" data-testid="end-page-input" />
            <div className="mt-6 w-full max-w-md space-y-2">
              <PillButton onClick={finishSession} disabled={addSession.isPending} data-testid="end-save"><Check size={18} className="mr-2" /> Speichern</PillButton>
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
