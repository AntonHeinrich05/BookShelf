from collections import Counter
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from auth_utils import get_current_user
from database import db
from cover_store import cover_path
from models import TaxonomyInput, TaxonomyItem, TaxonomyKind, User

router = APIRouter(tags=["taxonomy"])

KIND_FIELD = {"collections": "collections", "categories": "categories", "places": "places", "series": "series_name"}


async def load_books(user_id: str) -> list[dict]:
    return await db.books.find({"user_id": user_id}, {"_id": 0}).to_list(20000)


async def taxonomy_items(user_id: str, kind: str, books: list[dict]) -> list[dict]:
    defined = await db.taxonomy.find({"user_id": user_id, "kind": kind}, {"_id": 0}).to_list(2000)
    names = {d["name"] for d in defined}
    counts: Counter = Counter()
    field = KIND_FIELD[kind]
    for book in books:
        value = book.get(field)
        values = value if isinstance(value, list) else ([value] if value else [])
        for name in values:
            counts[name] += 1
    names |= set(counts.keys())
    return sorted([{"name": n, "count": counts[n]} for n in names], key=lambda x: x["name"].lower())


@router.get("/taxonomy/{kind}", response_model=List[TaxonomyItem])
async def list_taxonomy(kind: TaxonomyKind, user: User = Depends(get_current_user)):
    return await taxonomy_items(user.user_id, kind, await load_books(user.user_id))


@router.post("/taxonomy/{kind}", response_model=TaxonomyItem)
async def add_taxonomy(kind: TaxonomyKind, data: TaxonomyInput, user: User = Depends(get_current_user)):
    name = data.name.strip()
    existing = await taxonomy_items(user.user_id, kind, await load_books(user.user_id))
    for item in existing:
        if item["name"].lower() == name.lower():
            return item  # kein Duplikat anlegen
    await db.taxonomy.update_one(
        {"user_id": user.user_id, "kind": kind, "name": name},
        {"$setOnInsert": {"user_id": user.user_id, "kind": kind, "name": name}},
        upsert=True,
    )
    return {"name": name, "count": 0}


@router.patch("/taxonomy/{kind}/{name}", response_model=TaxonomyItem)
async def rename_taxonomy(kind: TaxonomyKind, name: str, data: TaxonomyInput, user: User = Depends(get_current_user)):
    new_name = data.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Name darf nicht leer sein")
    if new_name == name:
        field = KIND_FIELD[kind]
        return {"name": name, "count": await db.books.count_documents({"user_id": user.user_id, field: name})}
    field = KIND_FIELD[kind]
    await db.taxonomy.delete_many({"user_id": user.user_id, "kind": kind, "name": name})
    await db.taxonomy.update_one(
        {"user_id": user.user_id, "kind": kind, "name": new_name},
        {"$setOnInsert": {"user_id": user.user_id, "kind": kind, "name": new_name}},
        upsert=True,
    )
    if kind == "series":
        await db.books.update_many({"user_id": user.user_id, field: name}, {"$set": {field: new_name}})
    else:
        # Umbenennen = alten Namen entfernen, neuen hinzufügen (merge ohne Duplikate)
        await db.books.update_many({"user_id": user.user_id, field: name}, {"$addToSet": {field: new_name}})
        await db.books.update_many({"user_id": user.user_id, field: name}, {"$pull": {field: name}})
    count = await db.books.count_documents({"user_id": user.user_id, field: new_name})
    return {"name": new_name, "count": count}


@router.delete("/taxonomy/{kind}/{name}")
async def delete_taxonomy(kind: TaxonomyKind, name: str, user: User = Depends(get_current_user)):
    await db.taxonomy.delete_many({"user_id": user.user_id, "kind": kind, "name": name})
    field = KIND_FIELD[kind]
    if kind == "series":
        await db.books.update_many({"user_id": user.user_id, field: name}, {"$set": {field: None, "series_part": None}})
    else:
        await db.books.update_many({"user_id": user.user_id, field: name}, {"$pull": {field: name}})
    return {"ok": True}


@router.get("/authors")
async def list_authors(user: User = Depends(get_current_user)):
    books = [b for b in await load_books(user.user_id) if b.get("status") != "wishlist"]
    authors: dict[str, dict] = {}
    for book in books:
        for name in book.get("authors") or []:
            entry = authors.setdefault(name, {"name": name, "total": 0, "finished": 0, "pages": 0, "covers": []})
            entry["total"] += 1
            if book["status"] == "finished":
                entry["finished"] += 1
                entry["pages"] += book.get("page_count") or 0
            if len(entry["covers"]) < 3:
                entry["covers"].append(cover_path(book))
    return sorted(authors.values(), key=lambda a: (-a["total"], a["name"].lower()))
