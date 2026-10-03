import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { byValue, FORMATS, formatDate, formatDuration, OWNERSHIP, remainingSeconds, STATUSES, TAXONOMY } from "@/lib/constants";
import { Cover } from "./Cover";
import { CoverUpload } from "./CoverUpload";
import { Stars } from "./Bits";
import { ProgressRing } from "./ProgressRing";
import { SwipeRow } from "@/components/ios/SwipeRow";
import { FormGroup, FormRow, NativeSelect, SectionLabel, Segmented } from "@/components/ios/Form";

export function BookHero({ book, onPatch }) {
  const format = byValue(FORMATS, book.format);
  return (
    <section className="anim-in flex gap-5" data-testid="book-hero">
      <div className="w-28 shrink-0 sm:w-40"><Cover src={book.cover_url} title={book.title} author={book.authors?.[0]} large className="w-full" rounded="rounded-lg" /><CoverUpload book={book} /></div>
      <div className="min-w-0 flex-1 pt-1">
        <h1 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl" data-testid="book-title">{book.title}</h1>
        <p className="mt-1.5 text-[15px] text-fg2">
          {book.authors.map((a, i) => (
            <span key={a}>
              {i > 0 && ", "}
              <Link to={`/books?author=${encodeURIComponent(a)}`} className="underline-offset-4 hover:underline" data-testid="book-author-link">{a}</Link>
            </span>
          ))}
        </p>
        {book.series_name && (
          <Link to={`/books?series=${encodeURIComponent(book.series_name)}`} className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium" data-testid="book-series-link">
            <span className="truncate">{book.series_name}</span>{book.series_part != null && <span className="shrink-0 text-fg2">· Teil {Number.isInteger(book.series_part) ? book.series_part : book.series_part}</span>}
          </Link>
        )}
        <p className="mt-2 text-xs text-fg3">
          {[book.published_year, book.publisher, book.page_count && `${book.page_count} Seiten`, format?.label].filter(Boolean).join(" · ")}
        </p>
        <Stars value={book.rating} onChange={(v) => onPatch({ rating: v })} size={22} className="mt-3" testId="detail-rating" />
      </div>
    </section>
  );
}

export function StatusPicker({ value, onChange }) {
  return (
    <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6" data-testid="status-picker">
      {STATUSES.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          data-testid={`status-option-${v}`}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors duration-200 active:scale-95",
            value === v ? "border-fg bg-fg text-canvas" : "border-line text-fg2"
          )}
        >
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}

export function ReadingCard({ book, sessions = [], onPatch, onFinish, onStartReading, onDeleteSession }) {
  const [page, setPage] = useState(book.current_page);
  const [open, setOpen] = useState(() => (localStorage.getItem("bs_reading_card") ?? (book.status === "reading" ? "1" : "0")) === "1");
  const hasPages = book.page_count > 0;
  const pct = hasPages ? Math.round((page / book.page_count) * 100) : book.progress_percent || 0;
  const dirty = page !== book.current_page;
  const remaining = remainingSeconds({ ...book, progress_percent: pct });
  const tracked = book.reading_seconds > 0;
  const days = book.start_date && book.end_date ? Math.round((new Date(book.end_date) - new Date(book.start_date)) / 86400000) + 1 : null;
  const toggle = () => setOpen((o) => { localStorage.setItem("bs_reading_card", o ? "0" : "1"); return !o; });

  return (
    <section className="anim-in mt-5 overflow-hidden rounded-3xl bg-surface" data-testid="progress-card">
      <div className="flex items-center gap-3 p-3 pr-3">
        <button type="button" onClick={toggle} className="flex min-w-0 flex-1 items-center gap-3 text-left" data-testid="reading-card-toggle" aria-expanded={open}>
          <ProgressRing value={hasPages ? page : pct} max={hasPages ? book.page_count : 100} size={56} stroke={6} testId="detail-ring">
            <span className="font-display text-[13px] font-extrabold tabular-nums leading-none">{pct}%</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold">{book.status === "finished" ? "Gelesen" : "Lesen"}</p>
            <p className="truncate text-xs tabular-nums text-fg2" data-testid="reading-card-summary">
              {hasPages ? `S. ${page} / ${book.page_count}` : `${pct} %`}
              {book.status !== "finished" && book.estimated_seconds > 0 ? ` · noch ${formatDuration(remaining)}` : ""}
              {tracked ? ` · ${formatDuration(book.reading_seconds)} gelesen` : ""}
            </p>
          </div>
          <ChevronDown size={18} className={cn("shrink-0 text-fg3 transition-transform duration-200", open && "rotate-180")} />
        </button>
        {book.status !== "finished" && (
          <button type="button" onClick={onStartReading} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fg text-canvas transition-transform active:scale-90" aria-label="Lesen starten" data-testid="start-reading">
            <Play size={18} className="ml-0.5 fill-current" />
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3" data-testid="reading-card-body">
          {hasPages && (
            <>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={book.page_count} value={page} onChange={(e) => setPage(Number(e.target.value))} className="w-full" data-testid="progress-slider" />
                <input type="number" min={0} max={book.page_count} value={page} onFocus={(e) => e.target.select()} onChange={(e) => setPage(Math.min(book.page_count, Math.max(0, Number(e.target.value))))} className="w-[72px] rounded-xl bg-surface2 px-2 py-2 text-center text-[16px] tabular-nums outline-none" data-testid="progress-input" />
                <button type="button" disabled={!dirty} onClick={() => onPatch({ current_page: page, progress_type: "pages", ...(book.status !== "reading" && page < book.page_count ? { status: "reading" } : {}) })} className="shrink-0 rounded-full bg-fg px-3.5 py-2 text-sm font-semibold text-canvas transition-opacity disabled:opacity-30" data-testid="progress-save">
                  OK
                </button>
              </div>
            </>
          )}
          <button type="button" onClick={onFinish} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-line py-2.5 text-sm font-medium text-fg2 transition-colors hover:text-fg" data-testid="progress-finish">
            <Check size={16} /> {book.status === "finished" ? "Leseprotokoll & Bewertung" : "Fertig gelesen"}
          </button>

          <div className="mt-4 divide-y divide-line rounded-2xl bg-surface2/60" data-testid="reading-time">
            <div className="flex items-center justify-between px-3 py-2.5 text-sm">
              <span className="text-fg2">{tracked ? "Getrackte Lesezeit" : book.format === "audiobook" ? "Hörbuchlänge" : "Geschätzte Lesezeit"}</span>
              <span className="font-semibold tabular-nums">{formatDuration(tracked ? book.reading_seconds : book.estimated_seconds)}</span>
            </div>
            {days && (
              <div className="flex items-center justify-between px-3 py-2.5 text-sm">
                <span className="text-fg2">Dauer</span>
                <span className="tabular-nums">{days} {days === 1 ? "Tag" : "Tage"}</span>
              </div>
            )}
            {sessions.slice(0, 5).map((s) => (
              <SwipeRow key={s.id} actions={[{ label: "Löschen", icon: Trash2, onClick: () => onDeleteSession(s.id), className: "bg-red-500", testId: `delete-session-${s.id}` }]} testId={`session-${s.id}`}>
                <div className="flex items-center justify-between bg-surface px-3 py-2.5 text-sm">
                  <span className="text-fg2">{formatDate(s.ended_at.slice(0, 10))}{s.page_to != null ? ` · bis S. ${s.page_to}` : ""}</span>
                  <span className="tabular-nums">{formatDuration(s.seconds)}</span>
                </div>
              </SwipeRow>
            ))}
            {sessions.length > 5 && <p className="px-3 py-2 text-xs text-fg3">+ {sessions.length - 5} weitere Sessions</p>}
          </div>
        </div>
      )}
    </section>
  );
}

export function DatesGroup({ book, onPatch }) {
  const days = book.start_date && book.end_date ? Math.round((new Date(book.end_date) - new Date(book.start_date)) / 86400000) + 1 : null;
  const dateInput = (key) => (
    <input type="date" value={book[key] || ""} onChange={(e) => onPatch({ [key]: e.target.value || null })} className="bg-transparent text-right text-[16px] outline-none" data-testid={`detail-${key}`} />
  );
  return (
    <>
      <SectionLabel>Lesedaten</SectionLabel>
      <FormGroup>
        <FormRow label="Start">{dateInput("start_date")}</FormRow>
        <FormRow label="Ende">{dateInput("end_date")}</FormRow>
        {days && <FormRow label="Dauer"><span className="text-fg2">{days} {days === 1 ? "Tag" : "Tage"}</span></FormRow>}
      </FormGroup>
    </>
  );
}

export function DetailsGroup({ book, onPatch }) {
  return (
    <>
      <SectionLabel>Details</SectionLabel>
      <FormGroup>
        <FormRow label="Format"><Segmented value={book.format || "book"} onChange={(v) => onPatch({ format: v })} options={FORMATS} testId="detail-format" /></FormRow>
        {book.format === "audiobook" && <FormRow label="Länge"><span className="text-fg2">{book.audio_minutes ? formatDuration(book.audio_minutes * 60) : "–"}</span></FormRow>}
        <FormRow label="Besitz"><NativeSelect value={book.ownership} onChange={(v) => onPatch({ ownership: v })} options={OWNERSHIP} testId="detail-ownership" /></FormRow>
        {book.page_count && <FormRow label="Seiten"><span className="text-fg2">{book.page_count}</span></FormRow>}
        {book.publisher && <FormRow label="Verlag"><span className="truncate text-fg2">{book.publisher}</span></FormRow>}
        {book.published_year && <FormRow label="Jahr"><span className="text-fg2">{book.published_year}</span></FormRow>}
        {book.isbn && <FormRow label="ISBN"><span className="text-fg2">{book.isbn}</span></FormRow>}
        <FormRow label="Hinzugefügt"><span className="text-fg2">{formatDate(book.created_at.slice(0, 10))}</span></FormRow>
      </FormGroup>
    </>
  );
}

export function TagGroups({ book }) {
  const kinds = ["categories", "collections", "places"].filter((k) => book[k]?.length);
  if (!kinds.length) return null;
  return kinds.map((kind) => {
    const meta = TAXONOMY[kind];
    return (
      <div key={kind}>
        <SectionLabel>{meta.label}</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {book[kind].map((v) => (
            <Link key={v} to={`/books?${meta.param}=${encodeURIComponent(v)}`} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-sm transition-colors hover:bg-surface2" data-testid={`tag-${kind}-${v}`}>
              <meta.icon size={14} className="text-fg2" /> {v}
            </Link>
          ))}
        </div>
      </div>
    );
  });
}
