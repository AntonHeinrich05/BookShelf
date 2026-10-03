import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Plus, Search, Sparkles, X } from "lucide-react";
import { useBooks, useSearch } from "@/hooks/useBooks";
import { IconButton, PageHeader } from "@/components/layout/PageHeader";
import { Cover } from "@/components/books/Cover";
import { Chip } from "@/components/books/Bits";
import { BookCard, EmptyState } from "@/components/books/BookCard";
import { BookForm } from "@/components/books/BookForm";
import { LoadMore } from "@/components/books/LoadMore";

const MOODS = ["Romance", "Fantasy", "Thriller", "Krimi", "New Adult", "Dark Romance", "Sachbuch", "Klassiker", "Young Adult", "Historisch"];
const LANGS = [{ value: "", label: "Alle" }, { value: "de", label: "Deutsch" }, { value: "en", label: "Englisch" }];
const MANUAL = { status: "to_read" };

export default function SearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [lang, setLang] = useState(() => localStorage.getItem("bs_search_lang") ?? "de");
  const [selected, setSelected] = useState(null);
  const { data, isFetching, isError, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, refetch } = useSearch(debounced, lang);
  const { data: library = [] } = useBooks({ scope: "all" });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const seen = new Set();
  const results = (data?.pages.flatMap(p => p.items) || []).filter(item => {
    const key = item.result_key || item.google_id;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const unavailable = [...new Set(data?.pages.flatMap(p => p.degraded_sources || []) || [])];
  const names = { google: "Google Books", dnb: "Deutsche Nationalbibliothek", openlibrary: "Open Library" };

  return (
    <>
      <PageHeader title="Entdecken" right={<IconButton onClick={() => setSelected(MANUAL)} aria-label="Manuell hinzufügen" data-testid="manual-add-button"><Plus size={20} /></IconButton>} />

      <label className="flex h-12 items-center gap-3 rounded-2xl bg-surface px-4 anim-in">
        <Search size={18} className="text-fg3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche nach Titel, Autor oder ISBN" enterKeyHint="search" onKeyDown={(e) => e.key === "Enter" && e.target.blur()} className="w-full bg-transparent text-[16px] outline-none placeholder:text-fg3" data-testid="search-input" />
        {q && <button type="button" onClick={() => setQ("")} className="text-fg3" aria-label="Löschen" data-testid="search-clear"><X size={18} /></button>}
      </label>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        {LANGS.map((l) => <Chip key={l.value} active={lang === l.value} onClick={() => { setLang(l.value); localStorage.setItem("bs_search_lang", l.value); }} data-testid={`lang-${l.value || "all"}`}>{l.label}</Chip>)}
      </div>

      {!debounced.trim() && (
        <>
          <section className="mt-8 anim-in">
            <h2 className="mb-3 flex items-center gap-2 px-1 font-display text-xl font-bold tracking-tight"><Sparkles size={18} /> Ich habe Lust auf etwas…</h2>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => <Chip key={m} onClick={() => setQ(`subject:${m}`)} data-testid={`mood-${m}`}>{m}</Chip>)}
            </div>
          </section>
          {library.length > 0 && (
            <section className="mt-10 anim-in">
              <h2 className="mb-3 px-1 font-display text-xl font-bold tracking-tight">Zuletzt hinzugefügt</h2>
              <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {library.slice(0, 8).map((b, i) => <BookCard key={b.id} book={b} index={i} />)}
              </div>
            </section>
          )}
        </>
      )}

      {debounced.trim() && (
        <section className="mt-6" data-testid="search-results">
          <p className="mb-3 px-1 text-sm text-fg2" data-testid="search-result-count" aria-live="polite">{isFetching && !results.length ? "Buchkataloge werden durchsucht…" : isError && !results.length ? "Suche derzeit nicht verfügbar" : `${results.length} Treffer${hasNextPage ? " · weitere verfügbar" : ""}`}</p>
          {!!unavailable.length && <p className="mb-4 px-1 text-xs leading-relaxed text-fg2" data-testid="search-partial-notice">Gerade nicht erreichbar: {unavailable.map(n => names[n]).join(", ")}. Treffer der übrigen Kataloge werden angezeigt.</p>}
          {isError && !results.length && <button type="button" className="mb-4 rounded-full bg-surface px-5 py-3 text-sm" onClick={() => refetch()} data-testid="search-retry">Erneut versuchen</button>}
          {!isFetching && !isError && results.length === 0 && <EmptyState text="Nichts gefunden – versuch es mit einem anderen Begriff oder leg das Buch manuell an." />}
          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
            {results.map((item, i) => {
              const existing = library.find(b => (item.google_id && b.google_id === item.google_id) || (item.isbn && b.isbn === item.isbn));
              const owned = !!existing;
              return (
                <button key={item.result_key || item.google_id} type="button" onClick={() => existing ? navigate(`/books/${existing.id}`) : setSelected({ ...item, categories: [], auto_genre_hint: item.categories, status: "wishlist", ownership: "not_owned" })} className="group anim-in relative min-w-0 text-left" style={{ animationDelay: `${Math.min(i, 14) * 35}ms` }} data-testid={`search-result-${item.google_id}`}>
                  <Cover src={item.cover_url} title={item.title} author={item.authors?.[0]} className="w-full transition-transform duration-200 group-active:scale-95" />
                  {owned && <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white shadow"><Check size={13} strokeWidth={3} /></span>}
                  <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug" data-testid={`search-title-${item.google_id}`}>{item.title}</p>
                  <p className="truncate text-xs text-fg2" data-testid={`search-author-${item.google_id}`}>{item.authors.join(", ") || "Unbekannt"}{item.published_year ? ` · ${item.published_year}` : ""}</p>
                </button>
              );
            })}
          </div>
          <LoadMore hasMore={hasNextPage} loading={isFetchingNextPage} error={isFetchNextPageError} onLoad={fetchNextPage} testId="search-load-more" />
        </section>
      )}

      <BookForm open={!!selected} onOpenChange={(o) => !o && setSelected(null)} initial={selected} onSaved={(b) => navigate(`/books/${b.id}`)} />
    </>
  );
}
