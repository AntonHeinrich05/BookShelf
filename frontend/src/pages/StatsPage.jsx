import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, Tooltip, XAxis } from "recharts";
import { ChevronDown, ChevronRight, Star, User } from "lucide-react";
import { useStats } from "@/hooks/useBooks";
import { FORMATS, formatDuration, PERIODS, TAXONOMY } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { Splash } from "@/components/layout/Splash";
import { Group, Row } from "@/components/ios/Group";
import { Stars } from "@/components/books/Bits";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Cover } from "@/components/books/Cover";
import { Segmented } from "@/components/ios/Form";
import { cn } from "@/lib/utils";

const Tile = ({ label, value, sub, testId }) => (
  <div className="anim-in rounded-2xl bg-surface p-4" data-testid={testId}>
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-fg3">{label}</p>
    <p className="mt-2 font-display text-3xl font-extrabold tabular-nums tracking-tight">{value}</p>
    {sub && <p className="mt-1 text-xs text-fg2">{sub}</p>}
  </div>
);

const METRICS = [{ value: "books", label: "Bücher" }, { value: "pages", label: "Seiten" }, { value: "hours", label: "Stunden" }];

// Tooltip: nur die Zahl, kein "value"
const ChartTip = ({ active, payload, label, metric }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  const text = metric === "hours" ? formatDuration(v * 3600) : metric === "pages" ? `${Number(v).toLocaleString("de-DE")} Seiten` : `${v} ${v === 1 ? "Buch" : "Bücher"}`;
  return (
    <div className="rounded-xl bg-surface2 px-3 py-2 text-xs shadow" data-testid="chart-tooltip">
      <p className="text-fg2">{label}</p>
      <p className="font-semibold text-fg">{text}</p>
    </div>
  );
};

function ReadingChart({ chart, metric }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.floor(entries[0].contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="h-44 min-w-0" data-testid="reading-chart">
    {width > 0 && <BarChart width={width} height={176} data={chart} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
      <XAxis dataKey="name" tick={{ fill: "var(--c-fg2)", fontSize: 10 }} axisLine={false} tickLine={false} interval={chart.length > 13 ? "preserveStartEnd" : 0} />
      <Tooltip cursor={{ fill: "var(--c-surface2)" }} content={<ChartTip metric={metric} />} />
      <Bar dataKey="value" fill="var(--c-fg)" radius={[6, 6, 2, 2]} />
    </BarChart>}
  </div>;
}

/** Bewertungs-Balken: antippen → alle Bücher mit dieser Bewertung aufklappen */
function RatingRows({ byRating, ratedBooks }) {
  const [open, setOpen] = useState(null);
  const max = Math.max(1, ...Object.values(byRating));
  return [5, 4, 3, 2, 1].map((r) => {
    const count = byRating[r] || 0;
    const books = ratedBooks.filter((b) => b.rating === r);
    const expanded = open === r;
    return (
      <div key={r} className="border-b border-line last:border-b-0">
        <button type="button" onClick={() => count && setOpen(expanded ? null : r)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface2 disabled:opacity-60" disabled={!count} data-testid={`rating-row-${r}`} aria-expanded={expanded}>
          <Stars value={r} size={13} />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(count / max) * 100}%` }} /></div>
          <span className="w-6 text-right text-sm tabular-nums text-fg2">{count}</span>
          <ChevronDown size={16} className={cn("text-fg3 transition-transform", expanded && "rotate-180", !count && "opacity-30")} />
        </button>
        {expanded && (
          <div className="bg-surface2/50 px-3 pb-3 pt-1" data-testid={`rating-books-${r}`}>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {books.slice(0, 16).map((b) => (
                <Link key={b.id} to={`/books/${b.id}`} className="block transition-transform active:scale-95" title={b.title} data-testid={`rating-book-${b.id}`}>
                  <Cover src={b.cover_url} title={b.title} author={b.authors?.[0]} className="w-full" rounded="rounded" />
                </Link>
              ))}
            </div>
            <Link to={`/books?rating=${r}`} className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-tint" data-testid={`rating-all-${r}`}>
              Alle {count} Bücher mit {r} {r === 1 ? "Stern" : "Sternen"} <ChevronRight size={15} />
            </Link>
          </div>
        )}
      </div>
    );
  });
}

export default function StatsPage() {
  const [period, setPeriod] = useState(() => localStorage.getItem("bs_stats_period") || "year");
  const [metric, setMetric] = useState("books");
  const { data: s, isLoading } = useStats(period);
  const changePeriod = (p) => { setPeriod(p); localStorage.setItem("bs_stats_period", p); };

  if (isLoading || !s) return <><PageHeader title="Statistiken" /><Splash /></>;

  const chart = s.buckets.map((b) => ({ name: b.label, value: b[metric] }));
  const maxGenre = Math.max(1, ...(s.by_genre || []).map((g) => g.count));
  const ys = s.summary;
  const periodLabel = PERIODS.find((p) => p.value === period)?.sub || "";

  return (
    <>
      <PageHeader title="Statistiken" subtitle={`${s.totals.books_finished} Bücher · ${s.totals.pages_read.toLocaleString("de-DE")} Seiten · ${formatDuration(s.totals.seconds)} insgesamt`} right={
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="flex min-h-11 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-semibold sm:text-sm" data-testid="period-select">{PERIODS.find(p => p.value === period)?.label}<ChevronDown size={15} /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-line bg-surface text-fg" data-testid="period-menu">
            <DropdownMenuRadioGroup value={period} onValueChange={changePeriod}>
              {PERIODS.map(p => <DropdownMenuRadioItem key={p.value} value={p.value} data-testid={`period-${p.value}`}>{p.label}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      } />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Gelesen" value={ys.books} sub={periodLabel} testId="stat-books" />
        <Tile label="Seiten" value={ys.pages.toLocaleString("de-DE")} sub={periodLabel} testId="stat-pages" />
        <Tile label="Lesezeit" value={formatDuration(ys.seconds)} sub={ys.tracked_seconds ? `${formatDuration(ys.tracked_seconds)} davon getrackt` : "geschätzt (Seiten/Hörbuch)"} testId="stat-time" />
        <Tile label="Ø Lesedauer" value={ys.avg_days ?? "–"} sub="Tage pro Buch" testId="stat-days" />
        <Tile label="Ø Bewertung" value={ys.avg_rating ?? "–"} sub="von 5 Sternen" testId="stat-rating" />
        <Tile label="Ø pro Buch" value={ys.books ? formatDuration(ys.avg_seconds_per_book) : "–"} sub="Lesezeit beendeter Bücher" testId="stat-time-per-book" />
      </div>

      <section className="anim-in mt-5 rounded-2xl bg-surface p-4" data-testid="stats-chart">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold">{period === "month" ? "Pro Woche" : period === "all" ? "Pro Jahr" : "Pro Monat"}</h2>
          <Segmented value={metric} onChange={setMetric} options={METRICS} testId="metric-toggle" />
        </div>
        <ReadingChart chart={chart} metric={metric} />
      </section>

      <div className="mt-6 md:grid md:grid-cols-2 md:gap-x-6">
        <Group title="Bewertungen" testId="stats-ratings">
          <RatingRows byRating={s.by_rating} ratedBooks={s.rated_books || []} />
        </Group>
        <Group title="Genres" testId="stats-genres">
          {!s.by_genre?.length && <p className="px-4 py-5 text-center text-sm text-fg3">Noch keine Daten</p>}
          {(s.by_genre || []).map((g) => (
            <Link key={g.name} to={`/books?category=${encodeURIComponent(g.name)}`} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <TAXONOMY.categories.icon size={15} className="text-fg2" />
              <span className="w-28 truncate text-sm">{g.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-fg" style={{ width: `${(g.count / maxGenre) * 100}%` }} /></div>
              <span className="w-6 text-right text-sm tabular-nums text-fg2">{g.count}</span>
            </Link>
          ))}
        </Group>
        <Group title="Formate" testId="stats-formats">
          {FORMATS.map((f) => <Row key={f.value} icon={f.icon} label={f.label} value={s.by_format[f.value] || 0} />)}
        </Group>
        <Group title="Top Autor:innen" testId="stats-authors">
          {s.top_authors.length === 0 && <p className="px-4 py-5 text-center text-sm text-fg3">Noch keine Daten</p>}
          {s.top_authors.map((a) => <Row key={a.name} icon={User} label={a.name} value={`${a.count} ${a.count === 1 ? "Buch" : "Bücher"}`} to={`/books?author=${encodeURIComponent(a.name)}`} />)}
        </Group>
        {ys.longest && (
          <Group title="Längstes Buch" testId="stats-longest">
            <Link to={`/books/${ys.longest.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors active:bg-surface2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface2"><Star size={18} /></span>
              <span className="flex-1 truncate text-[16px]">{ys.longest.title}</span>
              <span className="text-fg2">{ys.longest.pages} S.</span>
            </Link>
          </Group>
        )}
      </div>
    </>
  );
}
