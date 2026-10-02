import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutGrid, List, Search } from "lucide-react";
import { useBooks } from "@/hooks/useBooks";
import { byValue, FORMATS, OWNERSHIP, SORT_OPTIONS, STATUSES } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { Splash } from "@/components/layout/Splash";
import { BookGrid } from "@/components/books/BookCard";
import { NativeSelect } from "@/components/ios/Form";
import { cn } from "@/lib/utils";

const FILTER_KEYS = ["status", "format", "ownership", "author", "place", "category", "collection", "series"];

function titleFor(f) {
  if (f.status) return byValue(STATUSES, f.status)?.label;
  if (f.format) return byValue(FORMATS, f.format)?.label;
  if (f.ownership) return byValue(OWNERSHIP, f.ownership)?.label;
  if (f.marked) return "Markiert";
  return f.author || f.place || f.category || f.collection || f.series || "Alle Bücher";
}

export default function BookListPage() {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(params.entries());
  const sort = filters.sort || (filters.series ? "series" : "added");
  const [q, setQ] = useState("");
  const [view, setView] = useState(() => localStorage.getItem("bs_view") || "grid");

  const query = useMemo(() => {
    const out = { sort };
    FILTER_KEYS.forEach((k) => filters[k] && (out[k] = filters[k]));
    if (filters.marked) out.marked = true;
    if (q.trim()) out.q = q.trim();
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, q, sort]);

  const { data: books = [], isLoading } = useBooks(query);
  const finished = books.filter((b) => b.status === "finished");
  const pages = finished.reduce((s, b) => s + (b.page_count || 0), 0);
  const subtitle = filters.author || filters.series
    ? `${books.length} Bücher · ${finished.length} gelesen · ${pages.toLocaleString("de-DE")} Seiten`
    : `${books.length} ${books.length === 1 ? "Buch" : "Bücher"}`;

  const changeView = (v) => {
    setView(v);
    localStorage.setItem("bs_view", v);
  };

  return (
    <>
      <PageHeader back title={titleFor(filters)} subtitle={subtitle} testId="book-list-header" />
      <div className="mb-5 flex items-center gap-2">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-full bg-surface px-4">
          <Search size={17} className="text-fg3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="In dieser Liste suchen" className="w-full bg-transparent text-[16px] outline-none placeholder:text-fg3" data-testid="list-search-input" />
        </label>
        <div className="flex h-11 items-center rounded-full bg-surface px-3">
          <NativeSelect value={sort} onChange={(v) => setParams((p) => { p.set("sort", v); return p; }, { replace: true })} options={SORT_OPTIONS} testId="list-sort" />
        </div>
        <div className="flex h-11 items-center rounded-full bg-surface p-1">
          {[["grid", LayoutGrid], ["list", List]].map(([v, Icon]) => (
            <button key={v} type="button" onClick={() => changeView(v)} className={cn("grid h-9 w-9 place-items-center rounded-full transition-colors", view === v ? "bg-fg text-canvas" : "text-fg2")} aria-label={v} data-testid={`view-${v}`}>
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>
      {isLoading ? <Splash /> : <BookGrid books={books} view={view} emptyText="Keine Bücher gefunden." />}
    </>
  );
}
