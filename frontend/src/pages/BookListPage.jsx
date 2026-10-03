import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutGrid, List, Search } from "lucide-react";
import { useBooks } from "@/hooks/useBooks";
import { byValue, FORMATS, LIST_CHIPS, NO_SERIES, OWNERSHIP, READ_FILTERS, SORT_OPTIONS, STATUSES } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { Splash } from "@/components/layout/Splash";
import { BookGrid } from "@/components/books/BookCard";
import { Chip } from "@/components/books/Bits";
import { NativeSelect } from "@/components/ios/Form";
import { cn } from "@/lib/utils";

const FILTER_KEYS = ["status", "format", "ownership", "read", "author", "place", "category", "collection", "series", "rating"];

function titleFor(f) {
  if (f.status) return byValue(STATUSES, f.status)?.label;
  if (f.format) return byValue(FORMATS, f.format)?.label;
  if (f.ownership && !f.read) return byValue(OWNERSHIP, f.ownership)?.label;
  if (f.read && !f.ownership) return byValue(READ_FILTERS, f.read)?.label;
  if (f.marked) return "Markiert";
  if (f.rating) return `${f.rating} ${f.rating === "1" ? "Stern" : "Sterne"}`;
  if (f.series === NO_SERIES) return "Einzelne Bücher";
  return f.author || f.place || f.category || f.collection || f.series || "Alle Bücher";
}

const matchRead = (b, read) => !read || (read === "read" ? b.status === "finished" : b.status !== "finished");
const matchOwn = (b, own) => !own || b.ownership === own;

export default function BookListPage() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(params.entries());
  const sort = filters.sort || (filters.series && filters.series !== NO_SERIES ? "series" : "added");
  const [q, setQ] = useState("");
  const [view, setView] = useState(() => localStorage.getItem("bs_view") || "grid");
  const isWishlist = filters.status === "wishlist";

  // Grundmenge (ohne die Chip-Filter) → daraus werden die Zähler für die Chips berechnet
  const baseQuery = useMemo(() => {
    const out = { sort, scope: isWishlist ? "all" : "library" };
    FILTER_KEYS.forEach((k) => filters[k] && !["ownership", "read"].includes(k) && (out[k] = filters[k]));
    if (filters.marked) out.marked = true;
    if (q.trim()) out.q = q.trim();
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, q, sort]);

  const { data: all = [], isLoading } = useBooks(baseQuery);
  const own = params.get("ownership") || "";
  const read = params.get("read") || "";
  const books = all.filter((b) => matchOwn(b, own) && matchRead(b, read));

  // Zähler je Chip: immer in Kombination mit dem jeweils anderen aktiven Filter
  const count = (chip) => {
    if (!chip.key) return all.length;
    if (chip.key === "read") return all.filter((b) => matchRead(b, chip.value) && matchOwn(b, own)).length;
    return all.filter((b) => matchOwn(b, chip.value) && matchRead(b, read)).length;
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

  const finished = books.filter((b) => b.status === "finished");
  const pages = finished.reduce((s, b) => s + (b.page_count || 0), 0);
  const subtitle = filters.author || filters.series
    ? `${books.length} Bücher · ${finished.length} gelesen · ${pages.toLocaleString("de-DE")} Seiten`
    : `${books.length} ${books.length === 1 ? "Buch" : "Bücher"}`;

  const setParam = (key, value) => setParams((p) => { value ? p.set(key, value) : p.delete(key); return p; }, { replace: true });
  const changeView = (v) => { setView(v); localStorage.setItem("bs_view", v); };
  const chips = LIST_CHIPS.filter((c) => !(filters.status && c.key === "read"));

  return (
    <>
      <PageHeader back title={titleFor(filters)} subtitle={subtitle} testId="book-list-header" />
      <div className="mb-3 flex items-center gap-2">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-full bg-surface px-4">
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

      {isLoading ? <Splash /> : <BookGrid books={books} view={view} emptyText="Keine Bücher gefunden." />}
    </>
  );
}
