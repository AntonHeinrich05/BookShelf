import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** The title never resizes. The subtitle is regular scroll content, not sticky chrome. */
export function PageHeader({ title, subtitle, back, right, large = true, testId = "page-header" }) {
  const navigate = useNavigate();
  return <>
    <header className="page-header -mx-4 px-4 sm:-mx-6 sm:px-6" data-testid={testId}>
      <div className="page-header-row">
        {back && <button type="button" onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-fg transition-transform active:scale-90"
          aria-label="Zurück" data-testid="back-button"><ChevronLeft size={20} /></button>}
        <h1 className={cn("min-w-0 flex-1 truncate font-display font-bold", large ? "page-header-title" : "text-lg")}
          data-testid={`${testId}-title`}>{title}</h1>
        {right && <div className="flex shrink-0 items-center gap-2" data-testid={`${testId}-actions`}>{right}</div>}
      </div>
    </header>
    {subtitle && <p className="page-subtitle" data-testid={`${testId}-subtitle`}>{subtitle}</p>}
    <div className="h-3" aria-hidden="true" />
  </>;
}

export function IconButton({ children, className, ...props }) {
  return <button type="button" className={cn("grid h-10 w-10 place-items-center rounded-full bg-surface text-fg transition-transform active:scale-90", className)} {...props}>{children}</button>;
}