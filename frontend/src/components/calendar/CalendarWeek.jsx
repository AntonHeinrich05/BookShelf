import { Link } from "react-router-dom";
import { format, isSameDay, isSameMonth } from "date-fns";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const LANE_H = 60;

export function CalendarWeek({ week, month, segs, laneCount, today }) {
  const hasLabels = segs.some((s) => s.showLabel);
  const laneH = hasLabels ? LANE_H : 22;
  return (
    <div className="relative border-t border-line/70">
      <div className="grid grid-cols-7">
        {week.map((day) => (
          <div key={day.toISOString()} className="flex h-10 items-start justify-center pt-2">
            <span
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full text-[13px] tabular-nums",
                !isSameMonth(day, month) && "text-fg3",
                isSameDay(day, today) && "bg-tint font-semibold text-white"
              )}
            >
              {format(day, "d")}
            </span>
          </div>
        ))}
      </div>
      <div className="relative" style={{ height: laneCount ? laneCount * laneH + 8 : 6 }}>
        {segs.map((seg) => (
          <Link
            key={`${seg.book.id}-${seg.startIdx}`}
            to={`/books/${seg.book.id}`}
            title={seg.book.title}
            data-testid={`calendar-span-${seg.book.id}`}
            className={cn("absolute flex h-[54px] items-end", !seg.showLabel && "h-[18px]")}
            style={{ left: `calc(${(seg.startIdx / 7) * 100}% + 3px)`, width: `calc(${((seg.endIdx - seg.startIdx + 1) / 7) * 100}% - 6px)`, top: seg.lane * laneH + (seg.showLabel ? 2 : hasLabels ? 38 : 4) }}
          >
            {seg.showLabel && (
              <div className="absolute inset-x-0 top-0 flex items-center gap-2 pr-1">
                {seg.book.cover_url ? (
                  <img src={seg.book.cover_url} alt="" className="h-[44px] w-[30px] shrink-0 rounded-[3px] object-cover shadow-[0_2px_6px_rgba(0,0,0,0.45)]" />
                ) : (
                  <span className="h-[44px] w-[30px] shrink-0 rounded-[3px]" style={{ background: seg.color }} />
                )}
                <span className="truncate text-[12px] font-semibold leading-tight">{seg.book.title}</span>
              </div>
            )}
            <div className="relative h-[7px] w-full overflow-visible">
              <div
                className={cn("absolute inset-y-0 left-0 right-0 opacity-90", seg.isStart && "rounded-l-full", (seg.isEnd || seg.reachesToday) && "rounded-r-full")}
                style={{ background: seg.color, ...(seg.showLabel ? { left: 34 } : {}), ...(seg.isEnd ? { right: 18 } : {}) }}
              />
              {seg.isEnd && (
                <span className="absolute -top-[6px] right-0 grid h-[19px] w-[19px] place-items-center rounded-full text-canvas" style={{ background: seg.color }}>
                  <Check size={11} strokeWidth={3.5} />
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
