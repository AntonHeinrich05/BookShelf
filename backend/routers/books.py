import re
import uuid
from collections import Counter
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from rapidfuzz import fuzz

from auth_utils import get_current_user
from database import db
from cover_store import cover_path, queue_cover
from book_pagination import book_page
from genres import canonical, detect_genre
from models import EST_MINUTES_PER_PAGE, Book, BookCreate, BookUpdate, User, now_iso
from routers.taxonomy import load_books, taxonomy_items
from sources import series_from_title
from standalone import is_read_standalone, read_standalone_filter

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


async def normalize(doc: dict, user_id: str, auto_hint=None, names_cache=None, ownership_changed=False) -> dict:
    today = date.today().isoformat()
    doc["title"] = (doc.get("title") or "").strip()
    if not doc["title"]:
        raise HTTPException(422, "Bitte einen Titel eingeben")
    for field in ("start_date", "end_date"):
        if doc.get(field):
            try:
                date.fromisoformat(doc[field])
            except (ValueError, TypeError):
                raise HTTPException(422, "Bitte ein gültiges Lesedatum eingeben")
    if doc.get("start_date") and doc.get("end_date") and doc["end_date"] < doc["start_date"]:
        raise HTTPException(422, "Das Enddatum darf nicht vor dem Startdatum liegen")
    if names_cache is None:
        books = await load_books(user_id)
        names_cache = {kind: [i["name"] for i in await taxonomy_items(user_id, kind, books)] for kind in ("places", "categories", "collections", "series")}
    if ownership_changed and doc.get("status") == "wishlist" and doc.get("ownership") in ("owned", "borrowed"):
        doc["status"] = "to_read"
    doc["authors"] = [a.strip() for a in doc.get("authors") or [] if a and a.strip()]
    for field in ("places", "categories", "collections"):
        existing = names_cache[field]
        seen, out = set(), []
        for v in doc.get(field) or []:
            if not v or not v.strip():
                continue
            name = canonical(v, existing)
            if name.lower() not in seen:
                seen.add(name.lower())
                out.append(name)
        doc[field] = out
        existing.extend(v for v in out if v not in existing)
    if not doc["categories"]:
        existing = names_cache["categories"]
        doc["categories"] = [canonical(detect_genre(auto_hint, doc.get("title", ""), doc.get("description") or ""), existing)]
    if doc.get("series_name"):
        existing = names_cache["series"]
        doc["series_name"] = canonical(doc["series_name"], existing) or None
        if doc["series_name"] and doc["series_name"] not in existing:
            existing.append(doc["series_name"])
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
    return {**Book(**b).model_dump(), "cover_url": cover_path(b), "estimated_seconds": estimated_seconds(b)}


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
        "collections": await taxonomy_items(user.user_id, "collections", library),
        "categories": await taxonomy_items(user.user_id, "categories", library),
        "places": await taxonomy_items(user.user_id, "places", library),
        "series": await taxonomy_items(user.user_id, "series", library),
        "series_none": sum(is_read_standalone(b) for b in library),
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
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(None, ge=1, le=200),
):
    query: dict = {"user_id": user.user_id}
    for key, value in {
        "status": status, "format": format, "authors": author,
        "places": place, "categories": category, "collections": collection, "series_name": series,
    }.items():
        if value:
            query[key] = value
    if series == "__none__":
        query.pop("series_name", None)
        query.update(read_standalone_filter())
    if rating is not None:
        query["rating"] = rating
    if not status and scope == "library":
        query["status"] = {"$ne": "wishlist"}
    if marked:
        query["marked"] = True
    base_query = dict(query)
    if ownership:
        query["ownership"] = ownership
    if read == "read":
        query["status"] = "finished"
    elif read == "unread":
        query["status"] = {"$nin": ["finished", "wishlist"]} if scope == "library" else {"$ne": "finished"}
    if marked:
        query["marked"] = True
    if limit is not None and not (q and q.strip()):
        page = await book_page(base_query, query, SORTS.get(sort, SORTS["added"]), skip, limit, ownership, read)
        page["items"] = [with_time(b) for b in page["items"]]
        return page
    books = await db.books.find(base_query if limit is not None else query, {"_id": 0}).sort(SORTS.get(sort, SORTS["added"]) + [("id", 1)]).to_list(20000)
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
    if limit is not None:
        base_books = books
        def matches_read(b):
            return not read or (b.get("status") == "finished") == (read == "read")
        counts = {"all": len(base_books),
                  "ownership": dict(Counter(b.get("ownership") for b in base_books if matches_read(b))),
                  "read": sum(b.get("status") == "finished" for b in base_books if not ownership or b.get("ownership") == ownership),
                  "unread": sum(b.get("status") != "finished" for b in base_books if not ownership or b.get("ownership") == ownership)}
        books = [b for b in base_books if matches_read(b) and (not ownership or b.get("ownership") == ownership)]
        finished = [b for b in books if b.get("status") == "finished"]
        return {"items": [with_time(b) for b in books[skip:skip + limit]], "total": len(books),
                "has_more": skip + limit < len(books), "next_skip": skip + limit,
                "summary": {"finished": len(finished), "pages": sum(b.get("page_count") or 0 for b in finished)},
                "counts": counts}
    return [with_time(b) for b in books]


@router.post("")
async def create_book(data: BookCreate, background_tasks: BackgroundTasks, user: User = Depends(get_current_user)):
    now = now_iso()
    payload = data.model_dump()
    hint = payload.pop("auto_genre_hint", None)
    if not payload.get("series_name"):  # „Reihe 2: Titel" / „Titel (Band 3)" → Reihe direkt übernehmen
        name, part = series_from_title(payload["title"])
        if name:
            payload["series_name"] = name
            payload["series_part"] = payload.get("series_part") if payload.get("series_part") is not None else part
    doc = await normalize({**payload, "id": str(uuid.uuid4()), "user_id": user.user_id, "created_at": now, "updated_at": now}, user.user_id, hint, ownership_changed=True)
    await db.books.insert_one({**doc})
    queue_cover(doc)
    return with_time(doc)


@router.get("/{book_id}")
async def get_book(book_id: str, user: User = Depends(get_current_user)):
    return with_time(await get_owned_book(book_id, user.user_id))


@router.patch("/{book_id}")
async def update_book(book_id: str, data: BookUpdate, background_tasks: BackgroundTasks, user: User = Depends(get_current_user)):
    existing = await get_owned_book(book_id, user.user_id)
    changes = data.model_dump(exclude_unset=True)
    for required in ("title", "status", "ownership", "progress_type", "rating", "current_page", "progress_percent", "marked"):
        if required in changes and changes[required] is None:
            raise HTTPException(422, f"{required} darf nicht leer sein")
    # Cover ownership belongs to the upload path, not a stale edit form.
    if existing.get("cover_custom") or (changes.get("cover_url") or "").startswith("/api/covers/"):
        changes.pop("cover_url", None)
    if "cover_url" in changes and changes["cover_url"] != existing.get("cover_url"):
        changes.update(cover_revision=None, cover_retry_after=None, cover_checked=False)
    merged = await normalize({**existing, **changes, "updated_at": now_iso()}, user.user_id, ownership_changed="ownership" in changes)
    # Patch only changed fields: background covers/timer updates must not be overwritten.
    updates = {k: v for k, v in merged.items() if k not in existing or v != existing[k]}
    await db.books.update_one({"id": book_id, "user_id": user.user_id}, {"$set": updates})
    current = await get_owned_book(book_id, user.user_id)
    if "cover_url" in updates:
        queue_cover(current)
    return with_time(current)


@router.delete("/{book_id}")
async def delete_book(book_id: str, user: User = Depends(get_current_user)):
    result = await db.books.delete_one({"id": book_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Buch nicht gefunden")
    await db.reading_sessions.delete_many({"book_id": book_id, "user_id": user.user_id})
    await db.covers.delete_many({"book_id": book_id, "user_id": user.user_id})
    return {"ok": True}
