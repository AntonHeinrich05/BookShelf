import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Cover } from "./Cover";
import { SeriesBadge, Stars } from "./Bits";
import { byValue, STATUSES } from "@/lib/constants";

export function BookCard({ book, index = 0, to }) {
  return (
    <Link to={to || `/books/${book.id}`} className="group anim-in block" style={{ animationDelay: `${Math.min(index, 14) * 35}ms` }} data-testid={`book-card-${book.id}`}>
      <Cover src={book.cover_url} title={book.title} author={book.authors?.[0]} className="w-full transition-transform duration-200 group-active:scale-95" />
      <div className="mt-2 min-w-0">
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug" data-testid="book-card-title">{book.title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <p className="truncate text-xs text-fg2">{book.authors?.join(", ")}</p>
          <SeriesBadge part={book.series_part} />
        </div>
      </div>
    </Link>
  );
}

export function BookRow({ book, index = 0 }) {
  const status = byValue(STATUSES, book.status);
  const StatusIcon = status?.icon;
  return (
    <Link to={`/books/${book.id}`} className="anim-in flex items-center gap-4 border-b border-line px-3 py-3 last:border-b-0 transition-colors active:bg-surface2" style={{ animationDelay: `${Math.min(index, 14) * 30}ms` }} data-testid={`book-row-${book.id}`}>
      <Cover src={book.cover_url} title={book.title} author={book.authors?.[0]} className="w-12" rounded="rounded" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{book.title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <p className="truncate text-sm text-fg2">{book.authors?.join(", ")}</p>
          <SeriesBadge part={book.series_part} />
        </div>
        {book.rating > 0 && <Stars value={book.rating} size={12} className="mt-1" />}
      </div>
      {StatusIcon && (
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface2 text-fg2")} title={status.label}>
          <StatusIcon size={15} />
        </span>
      )}
    </Link>
  );
}

export function BookGrid({ books, view = "grid", emptyText = "Noch keine Bücher hier." }) {
  if (!books?.length) return <EmptyState text={emptyText} />;
  if (view === "list") {
    return (
      <div className="overflow-hidden rounded-2xl bg-surface" data-testid="book-list">
        {books.map((b, i) => <BookRow key={b.id} book={b} index={i} />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7" data-testid="book-grid">
      {books.map((b, i) => <BookCard key={b.id} book={b} index={i} />)}
    </div>
  );
}

export function EmptyState({ text, children }) {
  return (
    <div className="anim-in rounded-2xl border border-dashed border-line px-6 py-14 text-center" data-testid="empty-state">
      <p className="text-sm text-fg2">{text}</p>
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  );
}
