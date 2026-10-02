import { Link } from "react-router-dom";
import { format, isSameDay, isSameMonth } from "date-fns";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const LANE_H = 26;

export function CalendarWeek({ week, month, segs, laneCount, today }) {
  return (
    <div className="relative border-t border-line/70">
      <div className="grid grid-cols-7">
        {week.map((day) => (
          <div key={day.toISOString()} className="flex h-9 items-start justify-center pt-1.5">
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full text-[13px] tabular-nums",
                !isSameMonth(day, month) && "text-fg3",
                isSameDay(day, today) && "bg-tint font-semibold text-white"
              )}
            >
              {format(day, "d")}
            </span>
          </div>
        ))}
      </div>
      <div className="relative" style={{ height: laneCount ? laneCount * LANE_H + 6 : 4 }}>
        {segs.map((seg) => (
          <Link
            key={`${seg.book.id}-${seg.startIdx}`}
            to={`/books/${seg.book.id}`}
            title={seg.book.title}
            data-testid={`calendar-span-${seg.book.id}`}
            style={{ left: `calc(${(seg.startIdx / 7) * 100}% + 2px)`, width: `calc(${((seg.endIdx - seg.startIdx + 1) / 7) * 100}% - 4px)`, top: seg.lane * LANE_H }}
            className={cn(
              "absolute flex h-[22px] items-center gap-1.5 overflow-hidden bg-surface2 pr-1.5 transition-colors hover:bg-surface3",
              seg.isStart ? "rounded-l-md pl-0.5" : "pl-1.5",
              (seg.isEnd || seg.reachesToday) && "rounded-r-md",
              seg.ongoing && "ring-1 ring-inset ring-tint/60",
              seg.reachesToday && "bg-gradient-to-r from-surface2 via-surface2 to-tint/20"
            )}
          >
            {seg.isStart && (seg.book.cover_url ? <img src={seg.book.cover_url} alt="" className="h-[18px] w-[13px] shrink-0 rounded-[2px] object-cover" /> : <span className="h-[18px] w-[13px] shrink-0 rounded-[2px] bg-surface3" />)}
            <span className="truncate text-[10px] font-medium leading-none">{seg.book.title}</span>
            {seg.isEnd && <Check size={11} strokeWidth={3} className="ml-auto shrink-0 text-emerald-400" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
