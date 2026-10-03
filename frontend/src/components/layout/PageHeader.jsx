import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, back, right, large = true, testId = "page-header" }) {
  const navigate = useNavigate();
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const root = document.getElementById("root");
    const update = () => setCompact((prev) => root.scrollTop > (prev ? 16 : 64));
    update();
    root.addEventListener("scroll", update, { passive: true });
    return () => root.removeEventListener("scroll", update);
  }, []);
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-3 bg-canvas/85 px-4 pb-2 pt-status backdrop-blur-xl sm:-mx-6 sm:px-6" data-testid={testId}>
      <div className="flex min-h-[40px] items-center gap-3">
        {back && (
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-fg transition-transform active:scale-90"
            aria-label="Zurück"
            data-testid="back-button"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className={cn("truncate font-display font-bold", large && !compact ? "text-2xl sm:text-3xl" : "text-lg")} data-testid={`${testId}-title`}>{title}</h1>
          {subtitle && !compact && <p className="truncate text-xs text-fg2" data-testid={`${testId}-subtitle`}>{subtitle}</p>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>
    </header>
  );
}

export function IconButton({ children, className, ...props }) {
  return (
    <button type="button" className={cn("grid h-10 w-10 place-items-center rounded-full bg-surface text-fg transition-transform active:scale-90", className)} {...props}>
      {children}
    </button>
  );
}
