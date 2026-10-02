import re
import uuid
from collections import Counter
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth_utils import get_current_user
from database import db
from models import Book, BookCreate, BookUpdate, User, now_iso
from routers.taxonomy import load_books, taxonomy_items

router = APIRouter(prefix="/books", tags=["books"])

SORTS = {
    "added": [("created_at", -1)],
    "title": [("title", 1)],
    "author": [("authors", 1), ("title", 1)],
    "rating": [("rating", -1), ("title", 1)],
    "finished": [("end_date", -1)],
    "series": [("series_name", 1), ("series_part", 1)],
}


def normalize(doc: dict) -> dict:
    today = date.today().isoformat()
    doc["authors"] = [a.strip() for a in doc.get("authors") or [] if a and a.strip()]
    for field in ("places", "categories", "collections"):
        doc[field] = [v.strip() for v in doc.get(field) or [] if v and v.strip()]
    if doc.get("series_name"):
        doc["series_name"] = doc["series_name"].strip() or None
    pages = doc.get("page_count") or 0
    if doc["status"] == "reading" and not doc.get("start_date"):
        doc["start_date"] = today
    if doc["status"] == "finished":
        doc["end_date"] = doc.get("end_date") or today
        doc["start_date"] = doc.get("start_date") or doc["end_date"]
        doc["progress_percent"] = 100
        if pages:
            doc["current_page"] = pages
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


@router.get("/overview")
async def overview(user: User = Depends(get_current_user)):
    books = await load_books(user.user_id)
    status_counts = Counter(b["status"] for b in books)
    format_counts = Counter(b.get("format") for b in books if b.get("format"))
    ownership_counts = Counter(b.get("ownership") for b in books)
    reading = sorted(
        [b for b in books if b["status"] == "reading"], key=lambda b: b.get("start_date") or "", reverse=True
    )
    return {
        "total": len(books),
        "status": dict(status_counts),
        "marked": sum(1 for b in books if b.get("marked")),
        "formats": dict(format_counts),
        "ownership": dict(ownership_counts),
        "authors_count": len({a for b in books for a in b.get("authors") or []}),
        "collections": await taxonomy_items(user.user_id, "collections", books),
        "categories": await taxonomy_items(user.user_id, "categories", books),
        "places": await taxonomy_items(user.user_id, "places", books),
        "series": await taxonomy_items(user.user_id, "series", books),
        "reading": [Book(**b) for b in reading],
    }


@router.get("", response_model=List[Book])
async def list_books(
    user: User = Depends(get_current_user),
    status: Optional[str] = None,
    format: Optional[str] = None,
    ownership: Optional[str] = None,
    marked: Optional[bool] = None,
    author: Optional[str] = None,
    place: Optional[str] = None,
    category: Optional[str] = None,
    collection: Optional[str] = None,
    series: Optional[str] = None,
    q: Optional[str] = None,
    sort: str = Query("added"),
):
    query: dict = {"user_id": user.user_id}
    for key, value in {
        "status": status,
        "format": format,
        "ownership": ownership,
        "authors": author,
        "places": place,
        "categories": category,
        "collections": collection,
        "series_name": series,
    }.items():
        if value:
            query[key] = value
    if marked:
        query["marked"] = True
    if q and q.strip():
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"title": rx}, {"authors": rx}, {"series_name": rx}]
    cursor = db.books.find(query, {"_id": 0}).sort(SORTS.get(sort, SORTS["added"]))
    return [Book(**b) for b in await cursor.to_list(20000)]


@router.post("", response_model=Book)
async def create_book(data: BookCreate, user: User = Depends(get_current_user)):
    now = now_iso()
    doc = normalize({**data.model_dump(), "id": str(uuid.uuid4()), "user_id": user.user_id, "created_at": now, "updated_at": now})
    await db.books.insert_one({**doc})
    return Book(**doc)


@router.get("/{book_id}", response_model=Book)
async def get_book(book_id: str, user: User = Depends(get_current_user)):
    return Book(**await get_owned_book(book_id, user.user_id))


@router.patch("/{book_id}", response_model=Book)
async def update_book(book_id: str, data: BookUpdate, user: User = Depends(get_current_user)):
    existing = await get_owned_book(book_id, user.user_id)
    merged = normalize({**existing, **data.model_dump(exclude_unset=True), "updated_at": now_iso()})
    await db.books.replace_one({"id": book_id, "user_id": user.user_id}, merged)
    return Book(**merged)


@router.delete("/{book_id}")
async def delete_book(book_id: str, user: User = Depends(get_current_user)):
    result = await db.books.delete_one({"id": book_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Buch nicht gefunden")
    return {"ok": True}
