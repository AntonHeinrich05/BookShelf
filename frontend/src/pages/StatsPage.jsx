import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useStats } from "@/hooks/useBooks";
import { byValue, FORMATS, MONTHS_SHORT } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { Splash } from "@/components/layout/Splash";
import { Group, Row } from "@/components/ios/Group";
import { Chip, Stars } from "@/components/books/Bits";
import { Segmented } from "@/components/ios/Form";
import { Book, Star, User } from "lucide-react";

const Tile = ({ label, value, sub, testId }) => (
  <div className="anim-in rounded-2xl bg-surface p-4" data-testid={testId}>
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-fg3">{label}</p>
    <p className="mt-2 font-display text-3xl font-extrabold tabular-nums tracking-tight">{value}</p>
    {sub && <p className="mt-1 text-xs text-fg2">{sub}</p>}
  </div>
);

export default function StatsPage() {
  const [year, setYear] = useState(null);
  const [metric, setMetric] = useState("books");
  const { data: s, isLoading } = useStats(year);

  if (isLoading || !s) return <><PageHeader title="Statistiken" /><Splash /></>;

  const chart = s.per_month.map((m) => ({ name: MONTHS_SHORT[m.month - 1], value: m[metric] }));
  const maxRating = Math.max(1, ...Object.values(s.by_rating));

  return (
    <>
      <PageHeader title="Statistiken" subtitle={`${s.totals.books_finished} Bücher · ${s.totals.pages_read.toLocaleString("de-DE")} Seiten insgesamt`} />

      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        {s.years.map((y) => <Chip key={y} active={y === s.year} onClick={() => setYear(y)} data-testid={`year-${y}`}>{y}</Chip>)}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Gelesen" value={s.year_summary.books} sub={`in ${s.year}`} testId="stat-books" />
        <Tile label="Seiten" value={s.year_summary.pages.toLocaleString("de-DE")} sub={`in ${s.year}`} testId="stat-pages" />
        <Tile label="Ø Bewertung" value={s.year_summary.avg_rating ?? "–"} sub="von 5 Sternen" testId="stat-rating" />
        <Tile label="Ø Lesedauer" value={s.year_summary.avg_days ?? "–"} sub="Tage pro Buch" testId="stat-days" />
      </div>

      <section className="anim-in mt-6 rounded-2xl bg-surface p-4" data-testid="stats-chart">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Pro Monat</h2>
          <Segmented value={metric} onChange={setMetric} options={[{ value: "books", label: "Bücher" }, { value: "pages", label: "Seiten" }]} testId="metric-toggle" />
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%" minHeight={176}>
            <BarChart data={chart} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: "var(--c-fg3)", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
              <Tooltip cursor={{ fill: "var(--c-surface2)" }} contentStyle={{ background: "var(--c-surface2)", border: "none", borderRadius: 12, color: "var(--c-fg)", fontSize: 12 }} itemStyle={{ color: "var(--c-fg)" }} labelStyle={{ color: "var(--c-fg2)" }} />
              <Bar dataKey="value" fill="var(--c-fg)" radius={[6, 6, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-8 md:grid md:grid-cols-2 md:gap-x-6">
        <Group title="Formate" testId="stats-formats">
          {FORMATS.map((f) => <Row key={f.value} icon={f.icon} label={f.label} value={s.by_format[f.value] || 0} />)}
          {s.by_format.unknown > 0 && <Row icon={Book} label="Ohne Format" value={s.by_format.unknown} />}
        </Group>
        <Group title="Bewertungen" testId="stats-ratings">
          {[5, 4, 3, 2, 1].map((r) => (
            <div key={r} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <Stars value={r} size={13} />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-amber-400" style={{ width: `${(s.by_rating[r] / maxRating) * 100}%` }} /></div>
              <span className="w-6 text-right text-sm tabular-nums text-fg2">{s.by_rating[r]}</span>
            </div>
          ))}
        </Group>
        <Group title="Top Autor:innen" testId="stats-authors">
          {s.top_authors.length === 0 && <p className="px-4 py-5 text-center text-sm text-fg3">Noch keine Daten</p>}
          {s.top_authors.map((a) => <Row key={a.name} icon={User} label={a.name} value={`${a.count} ${a.count === 1 ? "Buch" : "Bücher"}`} to={`/books?author=${encodeURIComponent(a.name)}`} />)}
        </Group>
        {s.year_summary.longest && (
          <Group title="Längstes Buch" testId="stats-longest">
            <Link to={`/books/${s.year_summary.longest.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors active:bg-surface2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface2"><Star size={18} /></span>
              <span className="flex-1 truncate text-[16px]">{s.year_summary.longest.title}</span>
              <span className="text-fg2">{s.year_summary.longest.pages} S.</span>
            </Link>
          </Group>
        )}
      </div>
    </>
  );
}
