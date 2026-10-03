import { useState } from "react";
import { cn } from "@/lib/utils";

export function Cover({ src, title, className, rounded = "rounded-md" }) {
  const [error, setError] = useState(false);
  return (
    <div className={cn("relative aspect-[2/3] shrink-0 overflow-hidden bg-surface2 shadow-[0_4px_14px_rgba(0,0,0,0.35)]", rounded, className)}>
      {src && !error ? (
        <img src={src} alt={title} loading="lazy" onError={() => setError(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="grain relative flex h-full w-full items-end bg-surface3 p-[8%]">
          <span className="line-clamp-4 font-display text-[11px] font-semibold leading-tight text-fg2">{title}</span>
        </div>
      )}
    </div>
  );
}
