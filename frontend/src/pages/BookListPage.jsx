import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutGrid, List, Search } from "lucide-react";
import { useBooks } from "@/hooks/useBooks";
import { byValue, FORMATS, OWNERSHIP, READ_FILTERS, SORT_OPTIONS, STATUSES } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { Splash } from "@/components/layout/Splash";
import { BookGrid } from "@/components/books/BookCard";
import { Chip } from "@/components/books/Bits";
import { NativeSelect } from "@/components/ios/Form";
import { cn } from "@/lib/utils";

const FILTER_KEYS = ["status", "format", "ownership", "read", "author", "place", "category", "collection", "series"];

function titleFor(f) {
  if (f.status) return byValue(STATUSES, f.status)?.label;
  if (f.format) return byValue(FORMATS, f.format)?.label;
  if (f.ownership) return byValue(OWNERSHIP, f.ownership)?.label;
  if (f.read) return byValue(READ_FILTERS, f.read)?.label;
  if (f.marked) return "Markiert";
  return f.author || f.place || f.category || f.collection || f.series || "Alle Bücher";
}

const OWN_CHIPS = [{ value: "", label: "Alle" }, ...OWNERSHIP.map((o) => ({ value: o.value, label: o.label }))];
const READ_CHIPS = [{ value: "", label: "Alle" }, { value: "read", label: "Gelesen" }, { value: "unread", label: "Ungelesen" }];

export default function BookListPage() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(params.entries());
  const sort = filters.sort || (filters.series ? "series" : "added");
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
  const books = all.filter((b) => (!own || b.ownership === own) && (!read || (read === "read" ? b.status === "finished" : b.status !== "finished")));

  const count = (key, value) => all.filter((b) => (!value ? true : key === "ownership" ? b.ownership === value : value === "read" ? b.status === "finished" : b.status !== "finished") && (key === "ownership" ? (!read || (read === "read" ? b.status === "finished" : b.status !== "finished")) : (!own || b.ownership === own))).length;

  const finished = books.filter((b) => b.status === "finished");
  const pages = finished.reduce((s, b) => s + (b.page_count || 0), 0);
  const subtitle = filters.author || filters.series
    ? `${books.length} Bücher · ${finished.length} gelesen · ${pages.toLocaleString("de-DE")} Seiten`
    : `${books.length} ${books.length === 1 ? "Buch" : "Bücher"}`;

  const setParam = (key, value) => setParams((p) => { value ? p.set(key, value) : p.delete(key); return p; }, { replace: true });
  const changeView = (v) => { setView(v); localStorage.setItem("bs_view", v); };

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
        <div className="mb-5 space-y-2" data-testid="list-filters">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
            {OWN_CHIPS.map((c) => (
              <Chip key={c.value} active={own === c.value} onClick={() => setParam("ownership", c.value)} data-testid={`filter-own-${c.value || "all"}`}>
                {c.label} <span className="tabular-nums opacity-60">{count("ownership", c.value)}</span>
              </Chip>
            ))}
          </div>
          {!filters.status && (
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
              {READ_CHIPS.map((c) => (
                <Chip key={c.value} active={read === c.value} onClick={() => setParam("read", c.value)} data-testid={`filter-read-${c.value || "all"}`}>
                  {c.label} <span className="tabular-nums opacity-60">{count("read", c.value)}</span>
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? <Splash /> : <BookGrid books={books} view={view} emptyText="Keine Bücher gefunden." />}
    </>
  );
}
