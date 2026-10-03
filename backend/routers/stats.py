from collections import Counter
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends

from auth_utils import get_current_user
from database import db
from models import User
from routers.books import estimated_seconds
from routers.taxonomy import load_books

router = APIRouter(prefix="/stats", tags=["stats"])

MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
PERIODS = {"month": 30, "quarter": 91, "year": 365, "all": None}


def pages_of(book: dict) -> int:
    return book.get("page_count") or 0


def days_between(book: dict) -> Optional[int]:
    if not (book.get("start_date") and book.get("end_date")):
        return None
    return (date.fromisoformat(book["end_date"]) - date.fromisoformat(book["start_date"])).days + 1


def safe_date(value: Optional[str]) -> Optional[date]:
    try:
        return date.fromisoformat((value or "")[:10])
    except ValueError:
        return None


def buckets_for(period: str, start: Optional[date], today: date, finished: list[dict], sessions: list[dict]) -> list[dict]:
    """Zeitachse passend zum Zeitraum: Monat → Wochen, Quartal/Jahr → Monate, Gesamt → Jahre."""
    ranges: list[tuple[str, date, date]] = []
    if period == "month":
        cursor = start
        while cursor <= today:
            end = min(cursor + timedelta(days=6), today)
            ranges.append((f"{cursor.day}.{cursor.month}.", cursor, end))
            cursor = end + timedelta(days=1)
    elif period in ("quarter", "year"):
        cursor = date(start.year, start.month, 1)
        while cursor <= today:
            nxt = date(cursor.year + (cursor.month == 12), cursor.month % 12 + 1, 1)
            label = MONTHS_SHORT[cursor.month - 1] + (f" {str(cursor.year)[2:]}" if period == "year" and cursor.month == 1 else "")
            ranges.append((label, cursor, nxt - timedelta(days=1)))
            cursor = nxt
    else:
        years = sorted({d.year for b in finished if (d := safe_date(b.get("end_date")))} | {today.year})
        for y in range(min(years), max(years) + 1):
            ranges.append((str(y), date(y, 1, 1), date(y, 12, 31)))
        if len(ranges) > 15:
            ranges = ranges[-15:]
    out = []
    for label, a, b in ranges:
        in_range = [bk for bk in finished if (d := safe_date(bk.get("end_date"))) and a <= d <= b]
        secs = sum(s["seconds"] for s in sessions if (d := safe_date(s.get("ended_at"))) and a <= d <= b)
        secs += sum(estimated_seconds(bk) for bk in in_range if not bk.get("reading_seconds"))
        out.append({"label": label, "books": len(in_range), "pages": sum(pages_of(bk) for bk in in_range), "hours": round(secs / 3600, 1)})
    return out


def period_start(period: str, today: date) -> Optional[date]:
    """month = letzte 30 Tage; quarter/year = 3 bzw. 12 ganze Monate inkl. aktuellem; all = alles."""
    if period == "month":
        return today - timedelta(days=29)
    if period in ("quarter", "year"):
        months_back = 2 if period == "quarter" else 11
        y, m = today.year, today.month - months_back
        while m <= 0:
            m += 12
            y -= 1
        return date(y, m, 1)
    return None


@router.get("")
async def stats(period: str = "year", user: User = Depends(get_current_user)):
    period = period if period in PERIODS else "year"
    today = date.today()
    start = period_start(period, today)

    books = await load_books(user.user_id)
    finished = [b for b in books if b["status"] == "finished"]
    reading = [b for b in books if b["status"] == "reading"]
    selected = [b for b in finished if (d := safe_date(b.get("end_date"))) and (start is None or d >= start)]

    sessions = await db.reading_sessions.find({"user_id": user.user_id}, {"_id": 0, "seconds": 1, "ended_at": 1, "book_id": 1}).to_list(100000)
    sel_sessions = [s for s in sessions if (d := safe_date(s.get("ended_at"))) and (start is None or d >= start)]
    tracked_sel = sum(s["seconds"] for s in sel_sessions)
    tracked_total = sum(s["seconds"] for s in sessions)
    estimated_sel = sum(estimated_seconds(b) for b in selected if not b.get("reading_seconds"))
    estimated_total = sum(estimated_seconds(b) for b in finished if not b.get("reading_seconds"))

    rated = [b["rating"] for b in selected if b.get("rating")]
    durations = [d for d in (days_between(b) for b in selected) if d]
    author_counter = Counter(a for b in selected for a in b.get("authors") or [])
    longest = max(selected, key=pages_of, default=None)
    rated_books = sorted(
        [{"id": b["id"], "title": b["title"], "authors": b.get("authors") or [], "cover_url": b.get("cover_url"), "rating": b["rating"], "end_date": b.get("end_date")} for b in selected if b.get("rating")],
        key=lambda b: (-b["rating"], b.get("end_date") or ""),
    )

    return {
        "period": period,
        "start": start.isoformat() if start else None,
        "totals": {
            "books_finished": len(finished),
            "pages_read": sum(pages_of(b) for b in finished) + sum(b.get("current_page") or 0 for b in reading),
            "library": len([b for b in books if b["status"] != "wishlist"]),
            "reading": len(reading),
            "seconds": tracked_total + estimated_total,
            "tracked_seconds": tracked_total,
        },
        "summary": {
            "books": len(selected),
            "pages": sum(pages_of(b) for b in selected),
            "seconds": tracked_sel + estimated_sel,
            "tracked_seconds": tracked_sel,
            "avg_rating": round(sum(rated) / len(rated), 1) if rated else None,
            "avg_days": round(sum(durations) / len(durations)) if durations else None,
            "longest": {"id": longest["id"], "title": longest["title"], "pages": pages_of(longest)} if longest else None,
        },
        "buckets": buckets_for(period, start, today, selected if start else finished, sel_sessions),
        "by_format": dict(Counter(b.get("format") or "book" for b in selected)),
        "by_genre": [{"name": n, "count": c} for n, c in Counter(g for b in selected for g in b.get("categories") or []).most_common(8)],
        "by_rating": {str(r): sum(1 for b in selected if b.get("rating") == r) for r in range(1, 6)},
        "rated_books": rated_books,
        "top_authors": [{"name": n, "count": c} for n, c in author_counter.most_common(5)],
    }
