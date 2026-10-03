import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPart } from "@/lib/constants";

export function SeriesBadge({ part, className }) {
  const text = formatPart(part);
  if (!text) return null;
  return <span className={cn("inline-flex shrink-0 items-center rounded-full bg-fg/10 px-2 py-0.5 text-[10px] font-semibold text-fg", className)} data-testid="series-badge">{text}</span>;
}

export function Stars({ value = 0, onChange, size = 16, className, testId = "rating-stars" }) {
  // Ohne onChange: reine Anzeige (span) – darf dann auch in Buttons/Links stehen
  const Item = onChange ? "button" : "span";
  return (
    <div className={cn("flex items-center gap-0.5", className)} data-testid={testId} role={onChange ? undefined : "img"} aria-label={onChange ? undefined : `${value} von 5 Sternen`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Item
          key={i}
          {...(onChange ? { type: "button", onClick: () => onChange(i === value ? 0 : i), "aria-label": `${i} Sterne` } : {})}
          className={cn(onChange && "transition-transform active:scale-75")}
          data-testid={`star-${i}`}
        >
          <Star size={size} className={i <= value ? "fill-amber-400 text-amber-400" : "text-fg3"} />
        </Item>
      ))}
    </div>
  );
}

export function Chip({ children, active, className, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 active:scale-95",
        active ? "border-fg bg-fg text-canvas" : "border-line bg-transparent text-fg2 hover:text-fg",
        className
      )}
    >
      {children}
    </button>
  );
}
