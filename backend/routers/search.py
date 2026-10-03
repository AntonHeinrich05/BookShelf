import asyncio
import os
import re
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from rapidfuzz import fuzz

from auth_utils import get_current_user
from database import db
from models import User

router = APIRouter(prefix="/search", tags=["search"])

GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"


def cover_from(volume: dict) -> Optional[str]:
    links = volume.get("imageLinks") or {}
    url = links.get("thumbnail") or links.get("smallThumbnail")
    if not url:
        return None
    url = url.replace("http://", "https://")
    url = re.sub(r"&?edge=curl", "", url)
    return url + "&fife=w400-h600"


def map_item(item: dict) -> dict:
    info = item.get("volumeInfo") or {}
    isbn = None
    for ident in info.get("industryIdentifiers") or []:
        if ident.get("type") == "ISBN_13":
            isbn = ident.get("identifier")
            break
        if ident.get("type") == "ISBN_10" and not isbn:
            isbn = ident.get("identifier")
    year = None
    if info.get("publishedDate"):
        match = re.match(r"\d{4}", info["publishedDate"])
        year = int(match.group()) if match else None
    return {
        "google_id": item.get("id"),
        "title": info.get("title") or "Ohne Titel",
        "subtitle": info.get("subtitle"),
        "authors": info.get("authors") or [],
        "cover_url": cover_from(info),
        "publisher": info.get("publisher"),
        "published_year": year,
        "page_count": info.get("pageCount"),
        "isbn": isbn,
        "description": info.get("description"),
        "categories": info.get("categories") or [],
        "language": info.get("language"),
    }


OPEN_LIBRARY_URL = "https://openlibrary.org/search.json"
OL_LANG = {"de": "ger", "en": "eng"}


def map_open_library(doc: dict) -> dict:
    cover_id = doc.get("cover_i")
    isbns = doc.get("isbn") or []
    return {
        "google_id": f"ol:{doc.get('key', '').rsplit('/', 1)[-1]}",
        "title": doc.get("title") or "Ohne Titel",
        "subtitle": None,
        "authors": doc.get("author_name") or [],
        "cover_url": f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg" if cover_id else None,
        "publisher": (doc.get("publisher") or [None])[0],
        "published_year": doc.get("first_publish_year"),
        "page_count": doc.get("number_of_pages_median"),
        "isbn": next((i for i in isbns if len(i) == 13), isbns[0] if isbns else None),
        "description": None,
        "categories": [],
        "language": (doc.get("language") or [None])[0],
    }


async def search_google(client: httpx.AsyncClient, q: str, lang: Optional[str], start: int) -> Optional[dict]:
    params = {"q": q, "maxResults": 20, "startIndex": start, "printType": "books", "orderBy": "relevance"}
    if lang:
        params["langRestrict"] = lang
    api_key = os.environ.get("GOOGLE_BOOKS_API_KEY")
    if api_key:
        params["key"] = api_key
    res = await client.get(GOOGLE_BOOKS_URL, params=params)
    if res.status_code != 200:
        return None
    data = res.json()
    return {"total": data.get("totalItems", 0), "items": [map_item(i) for i in data.get("items", [])], "source": "google"}


async def search_open_library(client: httpx.AsyncClient, q: str, lang: Optional[str], start: int) -> dict:
    params = {
        "q": q.replace("subject:", "subject:"),
        "limit": 20,
        "offset": start,
        "fields": "key,title,author_name,first_publish_year,number_of_pages_median,isbn,cover_i,publisher,language",
    }
    if lang and lang in OL_LANG:
        params["language"] = OL_LANG[lang]
    res = await client.get(OPEN_LIBRARY_URL, params=params)
    if res.status_code != 200:
        raise HTTPException(status_code=502, detail="Büchersuche derzeit nicht verfügbar")
    data = res.json()
    return {"total": data.get("numFound", 0), "items": [map_open_library(d) for d in data.get("docs", [])], "source": "openlibrary"}


DATAMUSE_URL = "https://api.datamuse.com/words"


async def correct_spelling(client: httpx.AsyncClient, q: str) -> Optional[str]:
    """Fehlertolerante Suche: jedes Wort ohne Treffer per Datamuse-Rechtschreibvorschlag korrigieren."""
    words = q.split()
    if not words or q.startswith("subject:"):
        return None

    async def fix(word: str) -> str:
        if len(word) < 4 or word.isdigit():
            return word
        try:
            res = await client.get(DATAMUSE_URL, params={"sp": word, "max": 1})
            best = (res.json() or [{}])[0].get("word") if res.status_code == 200 else None
        except Exception:
            best = None
        return best if best and best.lower() != word.lower() else word

    fixed = await asyncio.gather(*(fix(w) for w in words))
    corrected = " ".join(fixed)
    return corrected if corrected.lower() != q.lower() else None


async def run_search(client: httpx.AsyncClient, q: str, lang: Optional[str], start: int) -> Optional[dict]:
    google, openlib = await asyncio.gather(
        search_google(client, q, lang, start), search_open_library(client, q, lang, start), return_exceptions=True
    )
    google_ok = google if isinstance(google, dict) else None
    openlib_ok = openlib if isinstance(openlib, dict) else None
    if google_ok and google_ok["items"]:
        return google_ok
    if openlib_ok and openlib_ok["items"]:
        return openlib_ok
    return google_ok or openlib_ok


async def relaxed_search(client: httpx.AsyncClient, q: str, lang: Optional[str]) -> Optional[dict]:
    """Letzte Stufe: je ein Wort weglassen, Ergebnisse nach Ähnlichkeit zum Original filtern."""
    words = q.split()
    if len(words) < 2:
        return None
    variants = [" ".join(words[:i] + words[i + 1 :]) for i in range(len(words))]
    results = await asyncio.gather(*(run_search(client, v, lang, 0) for v in variants[:4]), return_exceptions=True)
    seen, items = set(), []
    for res in results:
        if not isinstance(res, dict):
            continue
        for item in res["items"]:
            key = item.get("google_id") or item["title"]
            hay = f"{item['title']} {' '.join(item.get('authors') or [])}"
            score = fuzz.token_set_ratio(q.lower(), hay.lower())
            if key not in seen and score >= 55:
                seen.add(key)
                items.append((score, item))
    if not items:
        return None
    items.sort(key=lambda x: -x[0])
    return {"total": len(items), "items": [i for _, i in items], "source": "fuzzy", "fuzzy": True}


@router.get("")
async def search_books(
    q: str = Query(min_length=1),
    lang: Optional[str] = None,
    start: int = 0,
    user: User = Depends(get_current_user),
):
    cache_key = {"q": q.strip().lower(), "lang": lang or "", "start": start}
    cached = await db.search_cache.find_one(cache_key, {"_id": 0, "result": 1})
    if cached:
        return cached["result"]
    async with httpx.AsyncClient(timeout=15) as client:
        result = await run_search(client, q, lang, start)
        if result is not None and not result["items"] and start == 0:
            corrected = await correct_spelling(client, q)
            if corrected:
                retry = await run_search(client, corrected, lang, start)
                if retry and retry["items"]:
                    result = {**retry, "corrected": corrected}
            if not result["items"]:
                relaxed = await relaxed_search(client, q, lang)
                if relaxed:
                    result = relaxed
    if result is None:
        raise HTTPException(status_code=502, detail="Büchersuche derzeit nicht verfügbar")
    if result["items"]:
        await db.search_cache.update_one(cache_key, {"$set": {"result": result, "created_at": datetime.now(timezone.utc)}}, upsert=True)
    return result
