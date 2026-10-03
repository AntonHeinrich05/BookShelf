import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from auth_utils import get_current_user
from database import db
from models import ReadingSession, SessionCreate, User, now_iso
from routers.books import get_owned_book, normalize, with_time

router = APIRouter(prefix="/books/{book_id}/sessions", tags=["sessions"])


async def recompute(book_id: str, user_id: str) -> dict:
    book = await get_owned_book(book_id, user_id)
    merged = await normalize({**book, "updated_at": now_iso()}, user_id)
    changed = {k: v for k, v in merged.items() if book.get(k) != v}
    if changed:
        await db.books.update_one({"id": book_id, "user_id": user_id}, {"$set": changed})
    return await get_owned_book(book_id, user_id)


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
        "id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"{user.user_id}:{book_id}:{data.client_id}")) if data.client_id else str(uuid.uuid4()), "user_id": user.user_id, "book_id": book_id, "seconds": data.seconds,
        "started_at": data.started_at or now, "ended_at": now, "page_from": data.page_from, "page_to": data.page_to, "note": data.note,
    }
    try:
        await db.reading_sessions.insert_one({**doc})
    except DuplicateKeyError:
        saved = await db.reading_sessions.find_one({"id": doc["id"], "user_id": user.user_id}, {"_id": 0})
        return {"session": ReadingSession(**saved), "book": with_time(await get_owned_book(book_id, user.user_id))}
    await db.books.update_one({"id": book_id, "user_id": user.user_id}, {"$inc": {"reading_seconds": data.seconds}})
    updates = {}
    if data.page_to is not None and book.get("page_count"):
        updates["current_page"] = min(book["page_count"], max(0, data.page_to))
        updates["progress_type"] = "pages"
        if updates["current_page"] >= book["page_count"]:
            updates["status"] = "finished"
    elif data.progress_percent is not None:
        updates.update(progress_type="percent", progress_percent=data.progress_percent)
        if data.progress_percent == 100:
            updates["status"] = "finished"
    if book["status"] in ("wishlist", "to_read") and updates.get("status") != "finished":
        updates["status"] = "reading"
    if updates:
        await db.books.update_one({"id": book_id, "user_id": user.user_id}, {"$set": updates})
    merged = await recompute(book_id, user.user_id)
    return {"session": ReadingSession(**doc), "book": with_time(merged)}


@router.delete("/{session_id}")
async def delete_session(book_id: str, session_id: str, user: User = Depends(get_current_user)):
    await get_owned_book(book_id, user.user_id)
    session = await db.reading_sessions.find_one_and_delete({"id": session_id, "book_id": book_id, "user_id": user.user_id}, projection={"_id": 0})
    if not session:
        raise HTTPException(404, "Leseprotokoll nicht gefunden")
    await db.books.update_one({"id": book_id, "user_id": user.user_id}, {"$inc": {"reading_seconds": -session["seconds"]}})
    return {"book": with_time(await recompute(book_id, user.user_id))}
