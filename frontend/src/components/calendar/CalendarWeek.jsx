import { Link } from "react-router-dom";
import { format, isSameDay, isSameMonth } from "date-fns";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Cover } from "@/components/books/Cover";

// Nur Cover + Balken, kein Titel (der steht in der Liste darunter / im Buch selbst)
const LANE_WITH_COVER = 44;
const LANE_BAR = 16;

export function CalendarWeek({ week, month, segs, laneCount, today }) {
  const hasCovers = segs.some((s) => s.showLabel);
  const laneH = hasCovers ? LANE_WITH_COVER : LANE_BAR;
  return (
    <div className="relative border-t border-line/70">
      <div className="grid grid-cols-7">
        {week.map((day) => (
          <div key={day.toISOString()} className="flex h-8 items-start justify-center pt-1">
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full text-[12px] tabular-nums",
                !isSameMonth(day, month) && "text-fg3",
                isSameDay(day, today) && "bg-tint font-semibold text-white"
              )}
            >
              {format(day, "d")}
            </span>
          </div>
        ))}
      </div>
      <div className="relative" style={{ height: laneCount ? laneCount * laneH + 4 : 2 }}>
        {segs.map((seg) => (
          <Link
            key={`${seg.book.id}-${seg.startIdx}`}
            to={`/books/${seg.book.id}`}
            title={seg.book.title}
            aria-label={seg.book.title}
            data-testid={`calendar-span-${seg.book.id}`}
            className="absolute flex items-end"
            style={{
              left: `calc(${(seg.startIdx / 7) * 100}% + 3px)`,
              width: `calc(${((seg.endIdx - seg.startIdx + 1) / 7) * 100}% - 6px)`,
              top: seg.lane * laneH + (seg.showLabel ? 1 : hasCovers ? LANE_WITH_COVER - LANE_BAR + 2 : 3),
              height: seg.showLabel ? LANE_WITH_COVER - 4 : 10,
            }}
          >
            {seg.showLabel && (
              <Cover src={seg.book.cover_url} title={seg.book.title} author={seg.book.authors?.[0]}
                className="absolute left-0 top-0 h-[36px] w-[24px]" rounded="rounded-[3px]" />
            )}
            <div className="relative h-[6px] w-full overflow-visible">
              <div
                className={cn("absolute inset-y-0 left-0 right-0 opacity-90", seg.isStart && "rounded-l-full", (seg.isEnd || seg.reachesToday) && "rounded-r-full")}
                style={{ background: seg.color, ...(seg.showLabel ? { left: 27 } : {}), ...(seg.isEnd ? { right: 16 } : {}) }}
              />
              {seg.isEnd && (
                <span className="absolute -top-[5px] right-0 grid h-[16px] w-[16px] place-items-center rounded-full text-canvas" style={{ background: seg.color }}>
                  <Check size={10} strokeWidth={3.5} />
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
