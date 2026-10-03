import uuid
from typing import List

from fastapi import APIRouter, Depends

from auth_utils import get_current_user
from database import db
from models import ReadingSession, SessionCreate, User, now_iso
from routers.books import get_owned_book, normalize, with_time

router = APIRouter(prefix="/books/{book_id}/sessions", tags=["sessions"])


async def recompute(book_id: str, user_id: str) -> dict:
    total = 0
    async for s in db.reading_sessions.find({"book_id": book_id, "user_id": user_id}, {"_id": 0, "seconds": 1}):
        total += s["seconds"]
    book = await get_owned_book(book_id, user_id)
    book["reading_seconds"] = total
    book["updated_at"] = now_iso()
    merged = await normalize(book, user_id)
    await db.books.replace_one({"id": book_id, "user_id": user_id}, merged)
    return merged


@router.get("", response_model=List[ReadingSession])
async def list_sessions(book_id: str, user: User = Depends(get_current_user)):
    await get_owned_book(book_id, user.user_id)
    docs = await db.reading_sessions.find({"book_id": book_id, "user_id": user.user_id}, {"_id": 0}).sort("ended_at", -1).to_list(2000)
    return [ReadingSession(**d) for d in docs]


@router.post("")
async def add_session(book_id: str, data: SessionCreate, user: User = Depends(get_current_user)):
    book = await get_owned_book(book_id, user.user_id)
    now = now_iso()
    doc = {
        "id": str(uuid.uuid4()), "user_id": user.user_id, "book_id": book_id, "seconds": data.seconds,
        "started_at": data.started_at or now, "ended_at": now, "page_from": data.page_from, "page_to": data.page_to, "note": data.note,
    }
    await db.reading_sessions.insert_one({**doc})
    updates = {}
    if data.page_to is not None and book.get("page_count"):
        updates["current_page"] = min(book["page_count"], max(0, data.page_to))
        updates["progress_type"] = "pages"
        if updates["current_page"] >= book["page_count"]:
            updates["status"] = "finished"
    if book["status"] in ("wishlist", "to_read") and updates.get("status") != "finished":
        updates["status"] = "reading"
    if updates:
        await db.books.update_one({"id": book_id, "user_id": user.user_id}, {"$set": updates})
    merged = await recompute(book_id, user.user_id)
    return {"session": ReadingSession(**doc), "book": with_time(merged)}


@router.delete("/{session_id}")
async def delete_session(book_id: str, session_id: str, user: User = Depends(get_current_user)):
    await db.reading_sessions.delete_one({"id": session_id, "book_id": book_id, "user_id": user.user_id})
    return {"book": with_time(await recompute(book_id, user.user_id))}
