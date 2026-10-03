import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Kreis-Fortschritt mit ziehbarem Knopf (wie im Bookshelf-Screenshot).
 * value 0..max; onChange optional → interaktiv.
 */
export function ProgressRing({ value = 0, max = 100, size = 280, stroke = 26, onChange, children, className, testId = "progress-ring" }) {
  const ref = useRef(null);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const angle = pct * 2 * Math.PI - Math.PI / 2;
  const knob = { x: size / 2 + r * Math.cos(angle), y: size / 2 + r * Math.sin(angle) };

  const fromPointer = useCallback(
    (e) => {
      if (!onChange || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      const x = p.clientX - rect.left - rect.width / 2;
      const y = p.clientY - rect.top - rect.height / 2;
      let a = Math.atan2(y, x) + Math.PI / 2;
      if (a < 0) a += 2 * Math.PI;
      const next = Math.round((a / (2 * Math.PI)) * max);
      // am Ende nicht "überspringen" (von 100 % auf 0 %)
      if (Math.abs(next - value) > max * 0.5) return onChange(value > max / 2 ? max : 0);
      onChange(next);
    },
    [onChange, max, value]
  );

  const drag = useRef(false);
  const start = (e) => { if (!onChange) return; drag.current = true; fromPointer(e); };
  const move = (e) => { if (drag.current) { e.preventDefault(); fromPointer(e); } };
  const end = () => { drag.current = false; };

  return (
    <div
      ref={ref}
      className={cn("ring-dial relative select-none", className)}
      style={{ width: size, height: size }}
      onMouseDown={start}
      onMouseMove={move}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchStart={start}
      onTouchMove={move}
      onTouchEnd={end}
      data-testid={testId}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-surface2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-tint)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-150" />
      </svg>
      {onChange && (
        <span className="absolute grid place-items-center rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.4)]" style={{ width: stroke + 14, height: stroke + 14, left: knob.x - (stroke + 14) / 2, top: knob.y - (stroke + 14) / 2 }}>
          <span className="rounded-full bg-tint" style={{ width: stroke + 2, height: stroke + 2 }} />
        </span>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
