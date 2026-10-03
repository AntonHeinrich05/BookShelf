import re
import uuid
from collections import Counter
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from rapidfuzz import fuzz

from auth_utils import get_current_user
from database import db
from genres import canonical, detect_genre
from models import EST_MINUTES_PER_PAGE, Book, BookCreate, BookUpdate, User, now_iso
from routers.taxonomy import load_books, taxonomy_items
from sources import series_from_title

router = APIRouter(prefix="/books", tags=["books"])

SORTS = {
    "added": [("created_at", -1)],
    "title": [("title", 1)],
    "author": [("authors", 1), ("title", 1)],
    "rating": [("rating", -1), ("title", 1)],
    "finished": [("end_date", -1)],
    "series": [("series_name", 1), ("series_part", 1)],
}

LEGACY_FORMATS = {"paperback": "book", "hardcover": "book", "ebuch": "ebook", "hoerbuch": "audiobook"}


def estimated_seconds(book: dict) -> int:
    """Gesamt-Lesezeit: Hörbuchlänge, sonst getrackt (fertig) bzw. aus persönlichem Tempo hochgerechnet, sonst Schätzung aus Seiten."""
    pages = book.get("page_count") or 0
    tracked = int(book.get("reading_seconds") or 0)
    if book.get("format") == "audiobook" and book.get("audio_minutes"):
        return int(book["audio_minutes"]) * 60
    if tracked and book.get("status") == "finished":
        return tracked
    if tracked and pages and (book.get("current_page") or 0) >= 10:
        return round(tracked * pages / book["current_page"])  # persönliches Lesetempo
    return int(pages * EST_MINUTES_PER_PAGE * 60)


async def existing_names(user_id: str, kind: str) -> list[str]:
    books = await load_books(user_id)
    return [i["name"] for i in await taxonomy_items(user_id, kind, books)]


async def normalize(doc: dict, user_id: str, auto_hint=None) -> dict:
    today = date.today().isoformat()
    doc["authors"] = [a.strip() for a in doc.get("authors") or [] if a and a.strip()]
    for field in ("places", "categories", "collections"):
        existing = await existing_names(user_id, field)
        seen, out = set(), []
        for v in doc.get(field) or []:
            if not v or not v.strip():
                continue
            name = canonical(v, existing)
            if name.lower() not in seen:
                seen.add(name.lower())
                out.append(name)
        doc[field] = out
    if not doc["categories"]:
        existing = await existing_names(user_id, "categories")
        doc["categories"] = [canonical(detect_genre(auto_hint, doc.get("title", ""), doc.get("description") or ""), existing)]
    if doc.get("series_name"):
        existing = await existing_names(user_id, "series")
        doc["series_name"] = canonical(doc["series_name"], existing) or None
    if doc.get("format") in LEGACY_FORMATS:
        doc["format"] = LEGACY_FORMATS[doc["format"]]
    doc["format"] = doc.get("format") or "book"
    pages = doc.get("page_count") or 0
    if doc["status"] == "reading" and not doc.get("start_date"):
        doc["start_date"] = today
    if doc["status"] == "finished":
        doc["end_date"] = doc.get("end_date") or today
        doc["start_date"] = doc.get("start_date") or doc["end_date"]
        doc["progress_percent"] = 100
        if pages:
            doc["current_page"] = pages
        doc["read_count"] = max(1, doc.get("read_count") or 0)
    elif pages and doc.get("progress_type") == "pages":
        doc["current_page"] = max(0, min(pages, doc.get("current_page") or 0))
        doc["progress_percent"] = round(doc["current_page"] * 100 / pages)
    elif pages and doc.get("progress_type") == "percent":
        doc["progress_percent"] = max(0, min(100, doc.get("progress_percent") or 0))
        doc["current_page"] = round(doc["progress_percent"] * pages / 100)
    return doc


async def get_owned_book(book_id: str, user_id: str) -> dict:
    doc = await db.books.find_one({"id": book_id, "user_id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Buch nicht gefunden")
    return doc


def with_time(b: dict) -> dict:
    return {**Book(**b).model_dump(), "estimated_seconds": estimated_seconds(b)}


@router.get("/overview")
async def overview(user: User = Depends(get_current_user)):
    books = await load_books(user.user_id)
    library = [b for b in books if b["status"] != "wishlist"]  # Wunschliste gehört nicht zur Bibliothek
    status_counts = Counter(b["status"] for b in books)
    reading = sorted([b for b in books if b["status"] == "reading"], key=lambda b: b.get("start_date") or "", reverse=True)
    return {
        "total": len(library),
        "wishlist": status_counts.get("wishlist", 0),
        "status": dict(status_counts),
        "marked": sum(1 for b in library if b.get("marked")),
        "formats": dict(Counter(b.get("format") or "book" for b in library)),
        "ownership": dict(Counter(b.get("ownership") for b in library)),
        "read": {"read": sum(1 for b in library if b["status"] == "finished"), "unread": sum(1 for b in library if b["status"] != "finished")},
        "authors_count": len({a for b in library for a in b.get("authors") or []}),
        "collections": await taxonomy_items(user.user_id, "collections", books),
        "categories": await taxonomy_items(user.user_id, "categories", books),
        "places": await taxonomy_items(user.user_id, "places", books),
        "series": await taxonomy_items(user.user_id, "series", books),
        "series_none": sum(1 for b in library if not b.get("series_name")),
        "covers_missing": sum(1 for b in library if not b.get("cover_url")),
        "reading": [with_time(b) for b in reading],
    }


@router.get("")
async def list_books(
    user: User = Depends(get_current_user),
    status: Optional[str] = None,
    format: Optional[str] = None,
    ownership: Optional[str] = None,
    read: Optional[str] = None,
    marked: Optional[bool] = None,
    author: Optional[str] = None,
    place: Optional[str] = None,
    category: Optional[str] = None,
    collection: Optional[str] = None,
    series: Optional[str] = None,
    q: Optional[str] = None,
    rating: Optional[int] = None,
    scope: str = Query("library"),  # library (ohne Wunschliste) | all
    sort: str = Query("added"),
):
    query: dict = {"user_id": user.user_id}
    for key, value in {
        "status": status, "format": format, "ownership": ownership, "authors": author,
        "places": place, "categories": category, "collections": collection, "series_name": series,
    }.items():
        if value:
            query[key] = value
    if series == "__none__":  # „Einzelne Bücher" – ohne Reihe
        query["series_name"] = {"$in": [None, ""]}
    if rating is not None:
        query["rating"] = rating
    if not status and scope == "library":
        query["status"] = {"$ne": "wishlist"}
    if read == "read":
        query["status"] = "finished"
    elif read == "unread":
        query["status"] = {"$nin": ["finished", "wishlist"]} if scope == "library" else {"$ne": "finished"}
    if marked:
        query["marked"] = True
    books = await db.books.find(query, {"_id": 0}).sort(SORTS.get(sort, SORTS["added"])).to_list(20000)
    if q and q.strip():
        needle = q.strip().lower()
        scored = []
        for b in books:
            hay = " ".join([b.get("title") or "", " ".join(b.get("authors") or []), b.get("series_name") or ""]).lower()
            score = max(fuzz.partial_ratio(needle, hay), fuzz.token_set_ratio(needle, hay))
            if needle in hay or score >= 72:  # fehlertolerant, aber nicht zu locker
                scored.append((score, b))
        scored.sort(key=lambda x: -x[0])
        books = [b for _, b in scored]
    return [with_time(b) for b in books]


@router.post("")
async def create_book(data: BookCreate, user: User = Depends(get_current_user)):
    now = now_iso()
    payload = data.model_dump()
    hint = payload.pop("auto_genre_hint", None)
    if not payload.get("series_name"):  # „Reihe 2: Titel" / „Titel (Band 3)" → Reihe direkt übernehmen
        name, part = series_from_title(payload["title"])
        if name:
            payload["series_name"] = name
            payload["series_part"] = payload.get("series_part") if payload.get("series_part") is not None else part
    doc = await normalize({**payload, "id": str(uuid.uuid4()), "user_id": user.user_id, "created_at": now, "updated_at": now}, user.user_id, hint)
    await db.books.insert_one({**doc})
    return with_time(doc)


@router.get("/{book_id}")
async def get_book(book_id: str, user: User = Depends(get_current_user)):
    return with_time(await get_owned_book(book_id, user.user_id))


@router.patch("/{book_id}")
async def update_book(book_id: str, data: BookUpdate, user: User = Depends(get_current_user)):
    existing = await get_owned_book(book_id, user.user_id)
    merged = await normalize({**existing, **data.model_dump(exclude_unset=True), "updated_at": now_iso()}, user.user_id)
    await db.books.replace_one({"id": book_id, "user_id": user.user_id}, merged)
    return with_time(merged)


@router.delete("/{book_id}")
async def delete_book(book_id: str, user: User = Depends(get_current_user)):
    result = await db.books.delete_one({"id": book_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Buch nicht gefunden")
    await db.reading_sessions.delete_many({"book_id": book_id, "user_id": user.user_id})
    return {"ok": True}
