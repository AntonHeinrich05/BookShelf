import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPart } from "@/lib/constants";

export function SeriesBadge({ part, className }) {
  const text = formatPart(part);
  if (!text) return null;
  return <span className={cn("inline-flex shrink-0 items-center rounded-full bg-fg/10 px-2 py-0.5 text-[10px] font-semibold text-fg", className)} data-testid="series-badge">{text}</span>;
}

export function Stars({ value = 0, onChange, size = 16, className, testId = "rating-stars" }) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} data-testid={testId}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(i === value ? 0 : i)}
          className={cn("disabled:cursor-default", onChange && "transition-transform active:scale-75")}
          aria-label={`${i} Sterne`}
          data-testid={`star-${i}`}
        >
          <Star size={size} className={i <= value ? "fill-amber-400 text-amber-400" : "text-fg3"} />
        </button>
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
