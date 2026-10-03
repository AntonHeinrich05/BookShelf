import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const KEY = "bs_timer";
const TimerContext = createContext(null);

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
};

/**
 * Globaler Lese-Timer: läuft über Seitenwechsel hinweg (Mini-Leiste über der TabBar),
 * übersteht Reloads (localStorage) und trackt nur echte Laufzeit.
 * state = { bookId, title, authors, cover_url, page_count, startPage, startedAt, accumulated, runningSince|null }
 */
export function ReadingTimerProvider({ children }) {
  const [timer, setTimer] = useState(load);
  const [, force] = useState(0);
  const tick = useRef(null);

  useEffect(() => {
    if (timer) localStorage.setItem(KEY, JSON.stringify(timer));
    else localStorage.removeItem(KEY);
  }, [timer]);

  useEffect(() => {
    if (timer?.runningSince) {
      tick.current = setInterval(() => force((n) => n + 1), 1000);
      return () => clearInterval(tick.current);
    }
  }, [timer?.runningSince]);

  const elapsed = timer ? timer.accumulated + (timer.runningSince ? Math.floor((Date.now() - timer.runningSince) / 1000) : 0) : 0;

  const start = useCallback((book) => {
    setTimer((t) =>
      t?.bookId === book.id
        ? { ...t, runningSince: t.runningSince || Date.now() }
        : { bookId: book.id, title: book.title, authors: book.authors, cover_url: book.cover_url, page_count: book.page_count, startPage: book.current_page || 0, startedAt: new Date().toISOString(), accumulated: 0, runningSince: Date.now() }
    );
  }, []);
  const pause = useCallback(() => setTimer((t) => (t?.runningSince ? { ...t, accumulated: t.accumulated + Math.floor((Date.now() - t.runningSince) / 1000), runningSince: null } : t)), []);
  const resume = useCallback(() => setTimer((t) => (t && !t.runningSince ? { ...t, runningSince: Date.now() } : t)), []);
  const clear = useCallback(() => setTimer(null), []);

  const value = useMemo(() => ({ timer, elapsed, running: !!timer?.runningSince, start, pause, resume, clear }), [timer, elapsed, start, pause, resume, clear]);
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export const useReadingTimer = () => useContext(TimerContext);
