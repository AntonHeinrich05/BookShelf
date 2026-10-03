import { differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, isSameDay, max, min, parseISO, startOfDay, startOfMonth, startOfWeek } from "date-fns";

const WEEK = { weekStartsOn: 1 };

export const monthWeeks = (month) => {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), WEEK), end: endOfWeek(endOfMonth(month), WEEK) });
  return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
};

const PALETTE = ["#e3a2a8", "#9fc8ad", "#e6c88f", "#b7a9e3", "#8dc7cc", "#d9a7cb", "#c9b98d", "#9fb6e3", "#e0b394", "#a8d0bf", "#f0a58f", "#8fb8e8"];

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
  // Farben im sichtbaren Monat eindeutig verteilen (keine zwei gleichen nebeneinander)
  spans.forEach((s, i) => { s.color = PALETTE[i % PALETTE.length]; });
  return spans;
}

export function weekSegments(week, spans, rangeStart) {
  const ws = week[0];
  const we = week[6];
  const segs = [];
  for (const span of spans) {
    if (span.end < ws || span.start > we) continue;
    const s = max([span.start, ws]);
    const e = min([span.end, we]);
    const isStart = isSameDay(span.start, s);
    segs.push({
      ...span,
      startIdx: differenceInCalendarDays(s, ws),
      endIdx: differenceInCalendarDays(e, ws),
      isStart,
      // Label (cover + title) once: at the real start, or in the first visible week of the month
      showLabel: isStart || (rangeStart && isSameDay(ws, rangeStart)),
      isEnd: !span.ongoing && isSameDay(span.end, e),
      reachesToday: span.ongoing && isSameDay(span.end, e),
    });
  }
  segs.sort((a, b) => a.startIdx - b.startIdx || a.start - b.start);
  const laneEnds = [];
  for (const seg of segs) {
    let lane = laneEnds.findIndex((end) => end < seg.startIdx);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(seg.endIdx);
    } else laneEnds[lane] = seg.endIdx;
    seg.lane = lane;
  }
  return { segs, laneCount: laneEnds.length };
}
