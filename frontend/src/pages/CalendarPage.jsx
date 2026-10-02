import { useState } from "react";
import { startOfMonth, format } from "date-fns";
import { useBooks } from "@/hooks/useBooks";
import { MONTHS } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";
import { Splash } from "@/components/layout/Splash";
import { ReadingCalendar } from "@/components/calendar/ReadingCalendar";
import { BookRow, EmptyState } from "@/components/books/BookCard";

export default function CalendarPage() {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const { data: books = [], isLoading } = useBooks({});
  const prefix = format(month, "yyyy-MM");
  const inMonth = books.filter((b) => b.start_date?.startsWith(prefix) || b.end_date?.startsWith(prefix) || (b.status === "reading" && b.start_date && b.start_date < prefix && prefix <= format(new Date(), "yyyy-MM")));
  const finished = inMonth.filter((b) => b.end_date?.startsWith(prefix));
  const pages = finished.reduce((s, b) => s + (b.page_count || 0), 0);

  return (
    <>
      <PageHeader title="Kalender" subtitle={`${finished.length} beendet · ${pages.toLocaleString("de-DE")} Seiten im ${MONTHS[month.getMonth()]}`} />
      {isLoading ? (
        <Splash />
      ) : (
        <>
          <ReadingCalendar month={month} onMonthChange={setMonth} books={books} />
          <section className="mt-8">
            <h2 className="mb-3 px-1 font-display text-xl font-bold tracking-tight">Im {MONTHS[month.getMonth()]} gelesen</h2>
            {inMonth.length === 0 ? (
              <EmptyState text="In diesem Monat wurde noch nichts gelesen." />
            ) : (
              <div className="overflow-hidden rounded-2xl bg-surface" data-testid="calendar-month-list">
                {inMonth.map((b, i) => <BookRow key={b.id} book={b} index={i} />)}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
