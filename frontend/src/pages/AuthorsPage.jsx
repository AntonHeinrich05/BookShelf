import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";
import { useAuthors } from "@/hooks/useBooks";
import { PageHeader } from "@/components/layout/PageHeader";
import { Splash } from "@/components/layout/Splash";
import { EmptyState } from "@/components/books/BookCard";

const initialsOf = (name) => name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export default function AuthorsPage() {
  const { data: authors = [], isLoading } = useAuthors();
  const [q, setQ] = useState("");
  const list = authors.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader back title="Autoren" subtitle={`${authors.length} Autor:innen`} />
      <label className="mb-5 flex h-11 items-center gap-2 rounded-full bg-surface px-4">
        <Search size={17} className="text-fg3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Autor:in suchen" className="w-full bg-transparent text-[16px] outline-none placeholder:text-fg3" data-testid="authors-search" />
      </label>
      {isLoading ? (
        <Splash />
      ) : list.length === 0 ? (
        <EmptyState text="Noch keine Autor:innen – füge dein erstes Buch hinzu." />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface" data-testid="authors-list">
          {list.map((a, i) => (
            <Link key={a.name} to={`/books?author=${encodeURIComponent(a.name)}`} className="anim-in flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0 transition-colors active:bg-surface2" style={{ animationDelay: `${Math.min(i, 14) * 25}ms` }} data-testid={`author-row-${a.name}`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface2 font-display text-sm font-bold text-fg2">{initialsOf(a.name)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold">{a.name}</p>
                <p className="text-sm text-fg2">{a.total} {a.total === 1 ? "Buch" : "Bücher"} · {a.finished} gelesen{a.pages ? ` · ${a.pages.toLocaleString("de-DE")} Seiten` : ""}</p>
              </div>
              <div className="flex -space-x-2">
                {a.covers.slice(0, 3).map((c) => <img key={c} src={c} alt="" className="h-9 w-6 rounded-[3px] object-cover ring-2 ring-surface" />)}
              </div>
              <ChevronRight size={18} className="text-fg3" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
