from collections import Counter
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends

from auth_utils import get_current_user
from models import User
from routers.taxonomy import load_books

router = APIRouter(prefix="/stats", tags=["stats"])


def pages_of(book: dict) -> int:
    return book.get("page_count") or 0


def days_between(book: dict) -> Optional[int]:
    if not (book.get("start_date") and book.get("end_date")):
        return None
    return (date.fromisoformat(book["end_date"]) - date.fromisoformat(book["start_date"])).days + 1


@router.get("")
async def stats(year: Optional[int] = None, user: User = Depends(get_current_user)):
    books = await load_books(user.user_id)
    finished = [b for b in books if b["status"] == "finished"]
    reading = [b for b in books if b["status"] == "reading"]
    years = sorted({int(b["end_date"][:4]) for b in finished if b.get("end_date")}, reverse=True)
    year = year or (years[0] if years else date.today().year)
    year_books = [b for b in finished if (b.get("end_date") or "").startswith(str(year))]

    per_month = []
    for month in range(1, 13):
        prefix = f"{year}-{month:02d}"
        in_month = [b for b in year_books if b["end_date"].startswith(prefix)]
        per_month.append({"month": month, "books": len(in_month), "pages": sum(pages_of(b) for b in in_month)})

    rated = [b["rating"] for b in year_books if b.get("rating")]
    durations = [d for d in (days_between(b) for b in year_books) if d]
    author_counter = Counter(a for b in year_books for a in b.get("authors") or [])
    longest = max(year_books, key=pages_of, default=None)

    return {
        "year": year,
        "years": years or [date.today().year],
        "totals": {
            "books_finished": len(finished),
            "pages_read": sum(pages_of(b) for b in finished) + sum(b.get("current_page") or 0 for b in reading),
            "library": len(books),
            "reading": len(reading),
        },
        "year_summary": {
            "books": len(year_books),
            "pages": sum(pages_of(b) for b in year_books),
            "avg_rating": round(sum(rated) / len(rated), 1) if rated else None,
            "avg_days": round(sum(durations) / len(durations)) if durations else None,
            "longest": {"id": longest["id"], "title": longest["title"], "pages": pages_of(longest)} if longest else None,
        },
        "per_month": per_month,
        "by_format": dict(Counter(b.get("format") or "unknown" for b in year_books)),
        "by_rating": {str(r): sum(1 for b in year_books if b.get("rating") == r) for r in range(1, 6)},
        "top_authors": [{"name": n, "count": c} for n, c in author_counter.most_common(5)],
    }
