import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { byValue, FORMATS, formatDate, OWNERSHIP, STATUSES, TAXONOMY } from "@/lib/constants";
import { Cover } from "./Cover";
import { Stars } from "./Bits";
import { FormGroup, FormRow, NativeSelect, SectionLabel } from "@/components/ios/Form";

export function BookHero({ book, onPatch }) {
  const format = byValue(FORMATS, book.format);
  return (
    <section className="anim-in flex gap-5" data-testid="book-hero">
      <Cover src={book.cover_url} title={book.title} className="w-32 sm:w-40" rounded="rounded-lg" />
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
          <Link to={`/books?series=${encodeURIComponent(book.series_name)}`} className="mt-2 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-medium" data-testid="book-series-link">
            {book.series_name}{book.series_part != null && <span className="text-fg2">· Teil {Number.isInteger(book.series_part) ? book.series_part : book.series_part}</span>}
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

export function ProgressCard({ book, onPatch }) {
  const [page, setPage] = useState(book.current_page);
  const pct = book.page_count ? Math.round((page / book.page_count) * 100) : book.progress_percent;
  const dirty = page !== book.current_page;
  return (
    <section className="anim-in mt-6 rounded-2xl bg-surface p-4" data-testid="progress-card">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-base font-semibold">Fortschritt</p>
        <p className="text-sm tabular-nums text-fg2">{page} / {book.page_count} Seiten · {pct}%</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2">
        <div className="h-full rounded-full bg-fg transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <input type="range" min={0} max={book.page_count} value={page} onChange={(e) => setPage(Number(e.target.value))} className="mt-4 w-full" data-testid="progress-slider" />
      <div className="mt-3 flex items-center gap-2">
        <input type="number" min={0} max={book.page_count} value={page} onFocus={(e) => e.target.select()} onChange={(e) => setPage(Math.min(book.page_count, Math.max(0, Number(e.target.value))))} className="w-24 rounded-xl bg-surface2 px-3 py-2 text-[16px] tabular-nums outline-none" data-testid="progress-input" />
        <button type="button" disabled={!dirty} onClick={() => onPatch({ current_page: page, progress_type: "pages", ...(book.status !== "reading" && page < book.page_count ? { status: "reading" } : {}) })} className="rounded-full bg-fg px-4 py-2 text-sm font-semibold text-canvas transition-opacity disabled:opacity-40" data-testid="progress-save">
          Speichern
        </button>
        {book.status !== "finished" && (
          <button type="button" onClick={() => onPatch({ status: "finished" })} className="ml-auto rounded-full border border-line px-4 py-2 text-sm font-medium text-fg2 transition-colors hover:text-fg" data-testid="progress-finish">
            Fertig gelesen
          </button>
        )}
      </div>
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
        <FormRow label="Format"><NativeSelect value={book.format} onChange={(v) => onPatch({ format: v })} options={FORMATS} placeholder="–" testId="detail-format" /></FormRow>
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
