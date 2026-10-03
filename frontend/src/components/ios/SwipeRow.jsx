import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * iOS-Style Swipe-Row: nach links wischen zeigt Aktionen (z. B. Umbenennen / Löschen).
 * actions = [{ label, icon, onClick, className, testId }]
 */
export function SwipeRow({ children, actions = [], className, testId }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const base = useRef(0);
  const width = actions.length * 84;

  const onStart = (e) => {
    const t = e.touches ? e.touches[0] : e;
    startX.current = t.clientX;
    startY.current = t.clientY;
    base.current = offset;
  };
  const onMove = (e) => {
    if (startX.current === null) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (!dragging && Math.abs(dy) > Math.abs(dx)) return (startX.current = null); // vertikal scrollen lassen
    if (!dragging && Math.abs(dx) < 6) return;
    setDragging(true);
    setOffset(Math.min(0, Math.max(-width - 20, base.current + dx)));
  };
  const onEnd = () => {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);
    setOffset(offset < -width / 2 ? -width : 0);
  };
  const close = () => setOffset(0);

  return (
    <div className={cn("swipe-row border-b border-line last:border-b-0", dragging && "dragging", className)} data-testid={testId}>
      <div className="swipe-actions">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => { close(); a.onClick(); }}
            className={cn("flex w-[84px] flex-col items-center justify-center gap-1 text-xs font-semibold text-white", a.className || "bg-surface3")}
            data-testid={a.testId}
          >
            {a.icon && <a.icon size={18} />}
            {a.label}
          </button>
        ))}
      </div>
      <div
        className="swipe-content"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        onMouseDown={onStart}
        onMouseMove={(e) => e.buttons === 1 && onMove(e)}
        onMouseUp={onEnd}
        onMouseLeave={() => startX.current !== null && onEnd()}
        onClickCapture={(e) => { if (offset !== 0) { e.preventDefault(); e.stopPropagation(); close(); } }}
      >
        {children}
      </div>
    </div>
  );
}
