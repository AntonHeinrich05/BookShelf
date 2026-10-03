import { useLocation, useNavigate } from "react-router-dom";
import { Pause, Play } from "lucide-react";
import { useReadingTimer } from "@/context/ReadingTimerContext";
import { Cover } from "@/components/books/Cover";
import { formatClock } from "@/lib/constants";

/** Mini-Leiste über der TabBar, solange ein Lese-Timer aktiv ist. */
export function TimerBar() {
  const { timer, elapsed, running, pause, resume } = useReadingTimer();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (!timer || pathname.endsWith("/read")) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(max(1.25rem,env(safe-area-inset-bottom))+76px)] z-40 flex justify-center px-4" data-testid="timer-bar">
      <button
        type="button"
        onClick={() => navigate(`/books/${timer.bookId}/read`)}
        className="flex w-full max-w-lg items-center gap-3 rounded-2xl border border-fg/10 bg-surface/90 p-2 pr-3 text-left shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-transform active:scale-[0.99]"
      >
        <Cover src={timer.cover_url} title={timer.title} className="w-9" rounded="rounded" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{timer.title}</p>
          <p className="truncate text-xs text-fg2">{timer.authors?.join(", ")}</p>
        </div>
        <span className="tabular font-display text-lg font-bold" data-testid="timer-bar-clock">{formatClock(elapsed)}</span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); running ? pause() : resume(); }}
          onKeyDown={(e) => e.key === "Enter" && (running ? pause() : resume())}
          className="grid h-9 w-9 place-items-center rounded-full bg-fg text-canvas"
          data-testid="timer-bar-toggle"
        >
          {running ? <Pause size={16} className="fill-current" /> : <Play size={16} className="ml-0.5 fill-current" />}
        </span>
      </button>
    </div>
  );
}
