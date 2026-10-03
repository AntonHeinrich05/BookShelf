import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function ProgressRing({ value = 0, max = 100, size = 280, stroke = 26, onChange, children, className, testId = "progress-ring" }) {
  const ref = useRef(null), arc = useRef(null), knob = useRef(null), dragging = useRef(false);
  const current = useRef(value), frame = useRef(null), callback = useRef(onChange);
  callback.current = onChange;
  const radius = (size - stroke) / 2, circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const angle = pct * 2 * Math.PI - Math.PI / 2;
  useEffect(() => { if (!dragging.current) current.current = value; }, [value]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const draw = next => {
    current.current = next;
    const progress = max > 0 ? next / max : 0;
    const a = progress * 2 * Math.PI - Math.PI / 2;
    arc.current?.setAttribute("stroke-dashoffset", circumference * (1 - progress));
    if (knob.current) {
      knob.current.style.left = `${(size / 2 + radius * Math.cos(a) - (stroke + 14) / 2) / size * 100}%`;
      knob.current.style.top = `${(size / 2 + radius * Math.sin(a) - (stroke + 14) / 2) / size * 100}%`;
    }
    if (!frame.current) frame.current = requestAnimationFrame(() => {
      frame.current = null;
      callback.current?.(current.current);
    });
  };
  const fromPointer = (e, initial = false) => {
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2, y = e.clientY - rect.top - rect.height / 2;
    let a = Math.atan2(y, x) + Math.PI / 2;
    if (a < 0) a += 2 * Math.PI;
    let next = Math.round(a / (2 * Math.PI) * max);
    if (!initial && Math.abs(next - current.current) > max / 2) next = current.current > max / 2 ? max : 0;
    draw(next);
  };
  const up = e => {
    if (!dragging.current) return;
    dragging.current = false;
    ref.current.classList.remove("dragging");
    cancelAnimationFrame(frame.current); frame.current = null;
    callback.current?.(current.current);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const keyDown = e => {
    const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (delta != null || ["Home", "End"].includes(e.key)) {
      e.preventDefault();
      draw(e.key === "Home" ? 0 : e.key === "End" ? max : Math.max(0, Math.min(max, current.current + delta)));
    }
  };
  return <div ref={ref} data-vaul-no-drag className={cn("ring-dial relative select-none", className)}
    style={{ width: size, maxWidth: "100%", aspectRatio: "1", touchAction: onChange ? "none" : "auto" }}
    role={onChange ? "slider" : undefined} tabIndex={onChange ? 0 : undefined}
    aria-label={onChange ? "Lesefortschritt" : undefined} aria-valuemin={onChange ? 0 : undefined} aria-valuemax={onChange ? max : undefined} aria-valuenow={onChange ? value : undefined}
    onKeyDown={onChange ? keyDown : undefined}
    onPointerDown={e => { if (!onChange) return; e.stopPropagation(); dragging.current = true; ref.current.classList.add("dragging"); e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e, true); }}
    onPointerMove={e => { if (dragging.current) { e.preventDefault(); e.stopPropagation(); fromPointer(e); } }}
    onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} data-testid={testId}>
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--c-surface2)" strokeWidth={stroke} />
      <circle ref={arc} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--c-tint)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct)} />
    </svg>
    {onChange && <span ref={knob} className="pointer-events-none absolute grid place-items-center rounded-full bg-white shadow-md" style={{ width: `${(stroke + 14) / size * 100}%`, aspectRatio: "1", left: `${(size / 2 + radius * Math.cos(angle) - (stroke + 14) / 2) / size * 100}%`, top: `${(size / 2 + radius * Math.sin(angle) - (stroke + 14) / 2) / size * 100}%` }}><span className="h-4/5 w-4/5 rounded-full bg-tint" /></span>}
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
  </div>;
}