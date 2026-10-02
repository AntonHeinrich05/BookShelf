import { useState } from "react";
import { Plus, X } from "lucide-react";

export function TagPicker({ values = [], onChange, suggestions = [], placeholder = "Hinzufügen…", testId }) {
  const [input, setInput] = useState("");
  const add = (raw) => {
    const value = raw.trim();
    if (!value || values.includes(value)) return setInput("");
    onChange([...values, value]);
    setInput("");
  };
  const filtered = suggestions.filter((s) => !values.includes(s) && s.toLowerCase().includes(input.toLowerCase())).slice(0, 8);

  return (
    <div className="px-4 py-3" data-testid={testId}>
      {values.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-fg text-canvas py-1 pl-3 pr-1.5 text-sm font-medium">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="grid h-5 w-5 place-items-center rounded-full hover:bg-canvas/20" aria-label={`${v} entfernen`}>
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(input);
            }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-[16px] outline-none placeholder:text-fg3"
          data-testid={testId ? `${testId}-input` : undefined}
        />
        {input.trim() && (
          <button type="button" onClick={() => add(input)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface2 text-fg" aria-label="Hinzufügen" data-testid={testId ? `${testId}-add` : undefined}>
            <Plus size={16} />
          </button>
        )}
      </div>
      {filtered.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filtered.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-line px-3 py-1 text-sm text-fg2 transition-colors hover:border-fg hover:text-fg">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
