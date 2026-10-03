import { Sparkles } from "lucide-react";
import { deriveSeries } from "@/lib/constants";

export function SeriesPicker({ value, onChange, suggestions = [], title }) {
  const derived = deriveSeries(title);
  const q = (value || "").toLowerCase();
  const matches = suggestions.filter((s) => s !== value && s !== derived && s.toLowerCase().includes(q)).slice(0, 8);
  return (
    <div className="px-4 py-3" data-testid="series-picker">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Name der Reihe suchen oder eingeben"
        className="w-full bg-transparent text-[16px] outline-none placeholder:text-fg3"
        data-testid="form-series"
      />
      {(matches.length > 0 || (derived && derived !== value)) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {derived && derived !== value && (
            <button type="button" onClick={() => onChange(derived)} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-fg/40 px-3 py-1 text-sm text-fg transition-colors hover:bg-surface2" data-testid="series-derived">
              <Sparkles size={13} /> {derived}
            </button>
          )}
          {matches.map((s) => (
            <button key={s} type="button" onClick={() => onChange(s)} className="rounded-full border border-line px-3 py-1 text-sm text-fg2 transition-colors hover:border-fg hover:text-fg" data-testid={`series-suggestion-${s}`}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
