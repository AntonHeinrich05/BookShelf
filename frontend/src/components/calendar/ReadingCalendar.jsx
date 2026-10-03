import { useMemo } from "react";
import { addMonths, endOfWeek, startOfDay, startOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTHS } from "@/lib/constants";
import { buildSpans, monthWeeks, weekSegments } from "./calendarUtils";
import { CalendarWeek } from "./CalendarWeek";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function ReadingCalendar({ month, onMonthChange, books }) {
  const today = startOfDay(new Date());
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const rangeStart = useMemo(() => startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), [month]);
  const spans = useMemo(() => {
    const rangeEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return buildSpans(books, rangeStart, rangeEnd);
  }, [books, month, rangeStart]);

  return (
    <div className="anim-in overflow-hidden rounded-2xl bg-surface" data-testid="reading-calendar">
      <div className="flex items-center justify-between px-3 py-3">
        <button type="button" onClick={() => onMonthChange(addMonths(month, -1))} className="grid h-9 w-9 place-items-center rounded-full bg-surface2 transition-transform active:scale-90" aria-label="Vorheriger Monat" data-testid="calendar-prev">
          <ChevronLeft size={18} />
        </button>
        <button type="button" onClick={() => onMonthChange(startOfMonth(new Date()))} className="font-display text-lg font-semibold" data-testid="calendar-month-label">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </button>
        <button type="button" onClick={() => onMonthChange(addMonths(month, 1))} className="grid h-9 w-9 place-items-center rounded-full bg-surface2 transition-transform active:scale-90" aria-label="Nächster Monat" data-testid="calendar-next">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 px-1 pb-1">
        {WEEKDAYS.map((d) => <span key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-fg3">{d}</span>)}
      </div>
      <div className="px-1 pb-2">
        {weeks.map((week) => {
          const { segs, laneCount } = weekSegments(week, spans, rangeStart);
          return <CalendarWeek key={week[0].toISOString()} week={week} month={month} segs={segs} laneCount={laneCount} today={today} />;
        })}
      </div>
    </div>
  );
}
