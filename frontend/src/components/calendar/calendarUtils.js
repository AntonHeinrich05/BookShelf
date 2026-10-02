import { differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, isSameDay, max, min, parseISO, startOfDay, startOfMonth, startOfWeek } from "date-fns";

const WEEK = { weekStartsOn: 1 };

export const monthWeeks = (month) => {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), WEEK), end: endOfWeek(endOfMonth(month), WEEK) });
  return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
};

export function buildSpans(books, rangeStart, rangeEnd) {
  const today = startOfDay(new Date());
  const spans = books
    .filter((b) => b.start_date)
    .map((b) => {
      const start = parseISO(b.start_date);
      const ongoing = !b.end_date && b.status === "reading";
      let end = b.end_date ? parseISO(b.end_date) : ongoing ? today : start;
      if (end < start) end = start;
      return { book: b, start, end, ongoing };
    })
    .filter((s) => !(s.end < rangeStart || s.start > rangeEnd))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const laneEnds = [];
  for (const span of spans) {
    let lane = laneEnds.findIndex((end) => end < span.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(span.end);
    } else laneEnds[lane] = span.end;
    span.lane = lane;
  }
  return spans;
}

export function weekSegments(week, spans) {
  const ws = week[0];
  const we = week[6];
  const segs = [];
  for (const span of spans) {
    if (span.end < ws || span.start > we) continue;
    const s = max([span.start, ws]);
    const e = min([span.end, we]);
    segs.push({
      ...span,
      startIdx: differenceInCalendarDays(s, ws),
      endIdx: differenceInCalendarDays(e, ws),
      isStart: isSameDay(span.start, s),
      isEnd: !span.ongoing && isSameDay(span.end, e),
      reachesToday: span.ongoing && isSameDay(span.end, e),
    });
  }
  return { segs, laneCount: segs.reduce((m, s) => Math.max(m, s.lane + 1), 0) };
}
