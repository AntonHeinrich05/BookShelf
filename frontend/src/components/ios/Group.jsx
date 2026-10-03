import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Group({ title, action, children, defaultOpen = true, testId, className }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn("mb-8 anim-in", className)} data-testid={testId}>
      {title && (
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="font-display text-xl font-bold tracking-tight md:text-2xl">{title}</h2>
          <div className="flex items-center gap-1">
            {action}
            <button type="button" onClick={() => setOpen((o) => !o)} className="grid h-9 w-9 place-items-center rounded-full text-fg2 transition-colors hover:text-fg" aria-label={open ? "Einklappen" : "Ausklappen"}>
              <ChevronDown size={20} className={cn("transition-transform duration-200", !open && "-rotate-90")} />
            </button>
          </div>
        </div>
      )}
      {open && <div className="overflow-hidden rounded-2xl bg-surface">{children}</div>}
    </section>
  );
}

export function Row({ icon: Icon, label, value, to, onClick, testId, iconClass, className, children }) {
  const inner = (
    <>
      {Icon && (
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface2 text-fg", iconClass)}>
          <Icon size={18} />
        </span>
      )}
      {children || <span className="flex-1 truncate text-[17px]">{label}</span>}
      {value !== undefined && <span className="tabular-nums text-fg2">{value}</span>}
      {(to || onClick) && <ChevronRight size={18} className="shrink-0 text-fg3" />}
    </>
  );
  const cls = cn("flex w-full min-h-[56px] items-center gap-4 border-b border-line px-4 py-2.5 text-left last:border-b-0 transition-colors active:bg-surface2", className);
  if (to) return <Link to={to} className={cls} data-testid={testId}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls} data-testid={testId}>{inner}</button>;
  return <div className={cls} data-testid={testId}>{inner}</div>;
}

export function EmptyRow({ text }) {
  return <p className="px-4 py-5 text-center text-sm text-fg3">{text}</p>;
}
