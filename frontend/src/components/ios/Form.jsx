import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const SectionLabel = ({ children }) => <p className="mb-2 mt-7 px-1 text-xs font-bold uppercase tracking-[0.18em] text-fg3">{children}</p>;

export const FormGroup = ({ children, className }) => <div className={cn("divide-y divide-line overflow-hidden rounded-2xl bg-surface", className)}>{children}</div>;

export const FormRow = ({ label, children, testId, className }) => (
  <div className={cn("flex min-h-[52px] items-center justify-between gap-4 px-4 py-2", className)} data-testid={testId}>
    {label && <span className="shrink-0 text-[16px] text-fg2">{label}</span>}
    <div className="flex min-w-0 flex-1 items-center justify-end">{children}</div>
  </div>
);

export const TextInput = ({ className, ...props }) => (
  <input {...props} onFocus={(e) => { e.target.select(); props.onFocus?.(e); }} className={cn("w-full bg-transparent text-right text-[16px] text-fg outline-none placeholder:text-fg3", className)} />
);

export const NativeSelect = ({ value, onChange, options, placeholder, testId }) => (
  <div className="relative inline-flex items-center text-fg">
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      data-testid={testId}
      className="max-w-[220px] cursor-pointer appearance-none truncate bg-transparent pr-6 text-right text-[16px] font-medium outline-none"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <ChevronsUpDown size={15} className="pointer-events-none absolute right-0 text-fg2" />
  </div>
);

export const Segmented = ({ value, onChange, options, testId }) => (
  <div className="inline-flex rounded-full bg-surface2 p-1" data-testid={testId}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200", value === o.value ? "bg-fg text-canvas" : "text-fg2")}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const PillButton = ({ className, children, ...props }) => (
  <button
    type="button"
    {...props}
    className={cn(
      "flex h-13 w-full items-center justify-center rounded-full bg-accent px-6 py-3.5 text-[17px] font-semibold text-accent-foreground transition-transform active:scale-[0.98] disabled:opacity-50",
      className
    )}
  >
    {children}
  </button>
);
