import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutGrid, List, Search } from "lucide-react";
import { usePagedBooks } from "@/hooks/useBooks";
import { byValue, FORMATS, LIST_CHIPS, NO_SERIES, OWNERSHIP, READ_FILTERS, SORT_OPTIONS, STATUSES } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { Splash } from "@/components/layout/Splash";
import { BookGrid } from "@/components/books/BookCard";
import { LoadMore } from "@/components/books/LoadMore";
import { Chip } from "@/components/books/Bits";
import { NativeSelect } from "@/components/ios/Form";
import { cn } from "@/lib/utils";

const FILTER_KEYS = ["status", "format", "ownership", "read", "author", "place", "category", "collection", "series", "rating"];

function titleFor(f) {
  if (f.series === NO_SERIES) return "Einzelne Bücher";
  if (f.status) return byValue(STATUSES, f.status)?.label;
  if (f.format) return byValue(FORMATS, f.format)?.label;
  if (f.ownership && !f.read) return byValue(OWNERSHIP, f.ownership)?.label;
  if (f.read && !f.ownership) return byValue(READ_FILTERS, f.read)?.label;
  if (f.marked) return "Markiert";
  if (f.rating) return `${f.rating} ${f.rating === "1" ? "Stern" : "Sterne"}`;
  if (f.series === NO_SERIES) return "Einzelne Bücher";
  return f.author || f.place || f.category || f.collection || f.series || "Alle Bücher";
}

export default function BookListPage() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(params.entries());
  const sort = filters.sort || (filters.series && filters.series !== NO_SERIES ? "series" : "added");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 250); return () => clearTimeout(t); }, [q]);
  const [view, setView] = useState(() => localStorage.getItem("bs_view") || "grid");
  const isWishlist = filters.status === "wishlist";

  // Grundmenge (ohne die Chip-Filter) → daraus werden die Zähler für die Chips berechnet
  const baseQuery = useMemo(() => {
    const out = { sort, scope: isWishlist ? "all" : "library" };
    FILTER_KEYS.forEach((k) => filters[k] && !["ownership", "read"].includes(k) && (out[k] = filters[k]));
    if (filters.marked) out.marked = true;
    if (debounced.trim()) out.q = debounced.trim();
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, debounced, sort]);

  const own = params.get("ownership") || "";
  const read = params.get("read") || "";
  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError } = usePagedBooks({ ...baseQuery, ownership: own || undefined, read: read || undefined });
  const first = data?.pages[0];
  const books = data?.pages.flatMap(p => p.items) || [];
  const total = first?.total || 0;

  // Zähler je Chip: immer in Kombination mit dem jeweils anderen aktiven Filter
  const count = (chip) => {
    if (!chip.key) return first?.counts?.all ?? total;
    if (chip.key === "read") return first?.counts?.[chip.value] || 0;
    return first?.counts?.ownership?.[chip.value] || 0;
  };
  const isActive = (chip) => (!chip.key ? !own && !read : chip.key === "read" ? read === chip.value : own === chip.value);
  const onChip = (chip) => {
    setParams((p) => {
      if (!chip.key) { p.delete("read"); p.delete("ownership"); return p; }
      const current = p.get(chip.key);
      current === chip.value ? p.delete(chip.key) : p.set(chip.key, chip.value);
      return p;
    }, { replace: true });
  };

  const finished = first?.summary?.finished || 0;
  const pages = first?.summary?.pages || 0;
  const subtitle = filters.author || filters.series
    ? `${total} Bücher · ${finished} gelesen · ${pages.toLocaleString("de-DE")} Seiten`
    : `${total} ${total === 1 ? "Buch" : "Bücher"}`;

  const setParam = (key, value) => setParams((p) => { value ? p.set(key, value) : p.delete(key); return p; }, { replace: true });
  const changeView = (v) => { setView(v); localStorage.setItem("bs_view", v); };
  const chips = LIST_CHIPS.filter((c) => !((filters.status || filters.series === NO_SERIES) && c.key === "read"));

  return (
    <>
      <PageHeader back title={titleFor(filters)} subtitle={subtitle} testId="book-list-header" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex h-11 min-w-[160px] flex-1 items-center gap-2 rounded-full bg-surface px-4">
          <Search size={17} className="text-fg3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="In dieser Liste suchen" className="w-full bg-transparent text-[16px] outline-none placeholder:text-fg3" data-testid="list-search-input" />
        </label>
        <div className="flex h-11 items-center rounded-full bg-surface px-3">
          <NativeSelect value={sort} onChange={(v) => setParam("sort", v)} options={SORT_OPTIONS} testId="list-sort" />
        </div>
        <div className="flex h-11 items-center rounded-full bg-surface p-1">
          {[["grid", LayoutGrid], ["list", List]].map(([v, Icon]) => (
            <button key={v} type="button" onClick={() => changeView(v)} className={cn("grid h-9 w-9 place-items-center rounded-full transition-colors", view === v ? "bg-fg text-canvas" : "text-fg2")} aria-label={v} data-testid={`view-${v}`}>
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      {!isWishlist && (
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6" data-testid="list-filters">
          {chips.map((c) => (
            <Chip key={`${c.key}-${c.value}`} active={isActive(c)} onClick={() => onChip(c)} data-testid={`filter-${c.key || "all"}-${c.value || "all"}`}>
              {c.label} <span className="tabular-nums opacity-60">{count(c)}</span>
            </Chip>
          ))}
        </div>
      )}

      {isLoading ? <Splash /> : isError && !books.length ? <button className="rounded-full bg-surface px-5 py-3" onClick={() => refetch()} data-testid="list-retry">Bücher konnten nicht geladen werden · Erneut versuchen</button> : <BookGrid books={books} view={view} emptyText="Keine Bücher gefunden." />}
      <LoadMore hasMore={hasNextPage} loading={isFetchingNextPage} error={isFetchNextPageError} onLoad={fetchNextPage} testId="books-load-more" />
    </>
  );
}
