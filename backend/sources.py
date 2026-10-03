"""Externe Buchquellen: Google Books, Open Library, Deutsche Nationalbibliothek (DNB).

Alle Funktionen sind fehlertolerant (liefern None / [] statt Exceptions), damit die Suche
immer ein Ergebnis zurückgibt, auch wenn eine Quelle gerade nicht erreichbar ist (z. B. Google-Quota).
"""
import asyncio
import os
import re
from defusedxml import ElementTree as ET
from typing import Optional

import httpx
from rapidfuzz import fuzz

GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"
OPEN_LIBRARY_URL = "https://openlibrary.org/search.json"
DNB_SRU_URL = "https://services.dnb.de/sru/dnb"
OL_LANG = {"de": "ger", "en": "eng"}
MARC_NS = {"m": "http://www.loc.gov/MARC21/slim"}


class SourcePage(list):
    """List-compatible result for existing enrichment code, with real source pagination."""
    def __init__(self, items=(), total=0, start=0, size=20, raw_count=None):
        super().__init__(items)
        self.total = int(total or 0)
        count = len(self) if raw_count is None else raw_count
        self.has_more = count > 0 and start + count < self.total

SERIES_PART_RE = re.compile(r"(?:Band|Bd\.?|Teil|Vol\.?|Volume|Book|Buch|Nr\.?|#|Tome)\s*(\d+(?:[.,]\d)?)", re.I)


def clean_isbn(value: Optional[str]) -> Optional[str]:
    digits = re.sub(r"[^0-9Xx]", "", value or "")
    return digits.upper() if len(digits) in (10, 13) else None


def part_from(text: str) -> Optional[float]:
    m = SERIES_PART_RE.search(text or "")
    if m:
        return float(m.group(1).replace(",", "."))
    m = re.fullmatch(r"\s*(\d+(?:[.,]\d)?)\s*", text or "")
    return float(m.group(1).replace(",", ".")) if m else None


def strip_series_from_title(title: str) -> str:
    """„Throne of Glass – Die Erwählte (Band 1)" → „Die Erwählte" bleibt Titel; nur Zusatz in Klammern/Bandangabe entfernen."""
    t = re.sub(r"\s*[\(\[][^\)\]]*(?:Band|Bd\.?|Teil|Vol\.?|Buch|Reihe|Serie|Series)[^\)\]]*[\)\]]", "", title, flags=re.I)
    t = re.sub(r"\s*[:\-–,]\s*(?:Band|Bd\.?|Teil|Vol\.?|Buch)\s*\d+(?:[.,]\d)?\s*$", "", t, flags=re.I)
    return t.strip() or title


def series_from_title(title: str) -> tuple[Optional[str], Optional[float]]:
    """Heuristik: „Reihe 3: Titel", „Titel (Reihe, Band 2)", „Reihe – Titel (Band 2)", „Titel: Reihe 2"."""
    if not title:
        return None, None
    part = part_from(title)
    paren = re.search(r"[\(\[]([^\)\]]+)[\)\]]", title)
    if paren and part is not None and SERIES_PART_RE.search(paren.group(1)) or (paren and re.search(r"\d", paren.group(1)) and re.search(r"Reihe|Serie|Series|Saga|Chroniken|Trilogie", paren.group(1), re.I)):
        name = SERIES_PART_RE.sub("", paren.group(1))
        # „Meine Reihe“ / „Die Chroniken-Saga“ are names, not removable labels.
        name = re.sub(r"^\s*(?:Reihe|Serie|Series)\s*:\s*", "", name, flags=re.I)
        name = re.sub(r"[\s,:\-–]+$", "", name).strip(" ,:-–")
        if len(name) >= 3:
            return name, part
    # A bare number is not evidence: e.g. „Berlin 24: Ein Tag“ is NOT a series.
    m = re.match(r"^(.{3,60}?)\s[-–:]\s(.+)$", title)  # „Reihe – Titel (Band 2)"
    if m and part is not None:
        left = m.group(1).strip()
        if not SERIES_PART_RE.search(left):
            return left, part
    m = re.search(r"[:\-–]\s*(.{3,60}?)\s*(?:Band|Teil|Bd\.?|Vol\.?)\s*(\d+(?:[.,]\d)?)\s*$", title, re.I)  # „Titel: Reihe Band 2"
    if m:
        return m.group(1).strip(" ,"), float(m.group(2).replace(",", "."))
    return None, part


# ---------------- Google Books ----------------
def google_cover(volume: dict) -> Optional[str]:
    links = volume.get("imageLinks") or {}
    url = links.get("thumbnail") or links.get("smallThumbnail")
    if not url:
        return None
    url = url.replace("http://", "https://")
    url = re.sub(r"&?edge=curl", "", url)
    return url + "&fife=w400-h600"


def map_google(item: dict) -> dict:
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
    series_info = info.get("seriesInfo") or {}
    return {
        "google_id": item.get("id"),
        "title": info.get("title") or "Ohne Titel",
        "subtitle": info.get("subtitle"),
        "authors": info.get("authors") or [],
        "cover_url": google_cover(info),
        "publisher": info.get("publisher"),
        "published_year": year,
        "page_count": info.get("pageCount"),
        "isbn": isbn,
        "description": info.get("description"),
        "categories": info.get("categories") or [],
        "language": info.get("language"),
        "series_part": part_from(str(series_info.get("bookDisplayNumber") or "")),
        "source": "google",
    }


async def google_search(client: httpx.AsyncClient, q: str, lang: Optional[str] = None, start: int = 0, max_results: int = 20) -> Optional[list[dict]]:
    isbn = clean_isbn(q)
    params = {"q": f"isbn:{isbn}" if isbn else q, "maxResults": min(max_results, 40), "startIndex": start, "printType": "books"}
    if lang:
        params["langRestrict"] = lang
    api_key = os.environ.get("GOOGLE_BOOKS_API_KEY")
    if api_key:
        params["key"] = api_key
    try:
        res = await client.get(GOOGLE_BOOKS_URL, params=params)
        if res.status_code != 200:
            return None
        data = res.json()
        return SourcePage([map_google(i) for i in data.get("items", [])], data.get("totalItems", 0), start, max_results)
    except Exception:
        return None


async def google_volume(client: httpx.AsyncClient, google_id: str) -> Optional[dict]:
    try:
        params = {}
        if os.environ.get("GOOGLE_BOOKS_API_KEY"):
            params["key"] = os.environ["GOOGLE_BOOKS_API_KEY"]
        res = await client.get(f"{GOOGLE_BOOKS_URL}/{google_id}", params=params)
        return map_google(res.json()) if res.status_code == 200 else None
    except Exception:
        return None


# ---------------- Open Library ----------------
def map_open_library(doc: dict) -> dict:
    cover_id = doc.get("cover_i")
    isbns = doc.get("isbn") or []
    return {
        "google_id": f"ol:{doc.get('key', '').rsplit('/', 1)[-1]}",
        "title": doc.get("title") or "Ohne Titel",
        "subtitle": None,
        "authors": doc.get("author_name") or [],
        "cover_url": f"https://covers.openlibrary.org/b/id/{cover_id}-M.jpg?default=false" if cover_id else None,
        "publisher": (doc.get("publisher") or [None])[0],
        "published_year": doc.get("first_publish_year"),
        "page_count": doc.get("number_of_pages_median"),
        "isbn": next((i for i in isbns if len(i) == 13), isbns[0] if isbns else None),
        "description": None,
        "categories": [],
        "language": {"ger": "de", "eng": "en"}.get((doc.get("language") or [None])[0], (doc.get("language") or [None])[0]),
        "series_part": None,
        "source": "openlibrary",
    }


async def open_library_search(client: httpx.AsyncClient, q: str, lang: Optional[str] = None, start: int = 0, limit: int = 20) -> Optional[list[dict]]:
    isbn = clean_isbn(q)
    query = f"isbn:{isbn}" if isbn else q
    if lang and lang in OL_LANG:
        query += f" language:{OL_LANG[lang]}"
    params = {"q": query, "limit": limit, "offset": start, "lang": lang or "de", "fields": "key,title,author_name,first_publish_year,number_of_pages_median,isbn,cover_i,publisher,language"}
    try:
        res = await client.get(OPEN_LIBRARY_URL, params=params)
        if res.status_code != 200:
            return None
        data = res.json()
        items = [map_open_library(d) for d in data.get("docs", [])]
        return SourcePage(items, data.get("numFound", data.get("num_found", 0)), start, limit)
    except Exception:
        return None


# ---------------- Deutsche Nationalbibliothek ----------------
def _sub(field, code: str) -> Optional[str]:
    el = field.find(f"m:subfield[@code='{code}']", MARC_NS)
    return (el.text or "").replace("\x98", "").replace("\x9c", "").strip() if el is not None and el.text else None


def map_dnb(record) -> Optional[dict]:
    fields = {}
    for df in record.findall(".//m:datafield", MARC_NS):
        fields.setdefault(df.get("tag"), []).append(df)
    title_f = (fields.get("245") or [None])[0]
    if title_f is None:
        return None
    title = _sub(title_f, "a") or ""
    subtitle = _sub(title_f, "b")
    authors = []
    for tag in ("100", "700"):
        for f in fields.get(tag, []):
            name = _sub(f, "a")
            role = (_sub(f, "4") or "").lower()
            if name and role in ("", "aut", "cre") and name not in authors:
                authors.append(" ".join(reversed([p.strip() for p in name.split(",")])) if name.count(",") == 1 else name)
    isbn = None
    for f in fields.get("020", []):
        candidate = clean_isbn(_sub(f, "a"))
        if candidate and (isbn is None or len(candidate) == 13):
            isbn = candidate
    pages = None
    for f in fields.get("300", []):
        m = re.search(r"(\d+)\s*(?:Seiten|S\.|pages|p\.)", _sub(f, "a") or "")
        if m:
            pages = int(m.group(1))
    publisher, year = None, None
    for tag in ("264", "260"):
        for f in fields.get(tag, []):
            publisher = publisher or _sub(f, "b")
            m = re.search(r"\d{4}", _sub(f, "c") or "")
            year = year or (int(m.group()) if m else None)
    series_name, series_part = None, None
    for f in fields.get("490", []) + fields.get("830", []):
        series_name = _sub(f, "a")
        series_part = part_from(_sub(f, "v") or "")
        if series_name and series_part is not None:
            break
    subjects = [s for f in fields.get("650", []) if (s := _sub(f, "a"))]
    ident = record.findtext("m:controlfield[@tag='001']", namespaces=MARC_NS) or isbn or title
    language = next((_sub(f, "a") for f in fields.get("041", []) if _sub(f, "a")), None)
    fixed = record.findtext("m:controlfield[@tag='008']", default="", namespaces=MARC_NS)
    language = language or (fixed[35:38].strip() if len(fixed) >= 38 else None)
    return {
        "google_id": f"dnb:{ident}",
        "title": title,
        "subtitle": subtitle,
        "authors": authors,
        "cover_url": f"https://portal.dnb.de/opac/mvb/cover?isbn={isbn}" if isbn else None,
        "publisher": publisher,
        "published_year": year,
        "page_count": pages,
        "isbn": isbn,
        "description": None,
        "categories": subjects,
        "language": {"ger": "de", "eng": "en"}.get(language, language),
        "series_name": series_name,
        "series_part": series_part,
        "source": "dnb",
    }


def _cql(value: str) -> str:
    return value.replace('"', " ").strip()


async def dnb_search(client: httpx.AsyncClient, query: str, maximum: int = 20, start: int = 0) -> Optional[list[dict]]:
    params = {"version": "1.1", "operation": "searchRetrieve", "query": query, "recordSchema": "MARC21-xml", "maximumRecords": maximum, "startRecord": start + 1}
    try:
        res = await client.get(DNB_SRU_URL, params=params)
        if res.status_code != 200:
            return None
        root = ET.fromstring(res.text)
        if root.find(".//{http://www.loc.gov/zing/srw/diagnostic/}diagnostic") is not None:
            return None
        out = []
        for rec in root.findall(".//m:record", MARC_NS):
            mapped = map_dnb(rec)
            if mapped and mapped["title"]:
                out.append(mapped)
        total = root.findtext(".//{http://www.loc.gov/zing/srw/}numberOfRecords", "0")
        return SourcePage(out, total, start, maximum, len(root.findall(".//m:record", MARC_NS)))
    except Exception:
        return None


async def dnb_search_text(client: httpx.AsyncClient, q: str, lang: Optional[str] = None, start: int = 0, limit: int = 20) -> Optional[list[dict]]:
    isbn = clean_isbn(q)
    if isbn:
        return await dnb_search(client, f"num={isbn}", limit, start)
    subject = q.startswith("subject:")
    q = q.removeprefix("subject:")
    words = [w for w in re.split(r"\s+", _cql(q)) if w]
    if not words:
        return []
    query = " and ".join(f'WOE="{w}"' for w in words)
    if subject:
        query = f'sw="{_cql(q)}"'
    # Include printed books AND ebooks/audio, not only mat=books.
    query += " and (mat=books or mat=online or mat=discs)"
    if lang in OL_LANG:  # Index spr verified against live SRU Explain.
        query += f" and spr={OL_LANG[lang]}"
    return await dnb_search(client, query, limit, start)


async def dnb_lookup(client: httpx.AsyncClient, title: str, author: Optional[str], isbn: Optional[str]) -> Optional[dict]:
    """Bester DNB-Treffer für ein Buch (für Reihen-Erkennung)."""
    results = None
    if clean_isbn(isbn):
        results = await dnb_search(client, f"num={clean_isbn(isbn)}", 3)
    if not results:
        core = strip_series_from_title(title)
        core = re.split(r"\s[:\-–]\s", core)[0] if len(core) > 40 else core
        query = f'tit="{_cql(core)}"'
        if author:
            last = _cql(author).split()[-1] if _cql(author).split() else ""
            if last:
                query += f' and per="{last}"'
        results = await dnb_search(client, query + " and mat=books", 8)
    if not results:
        return None
    hay_q = f"{title} {author or ''}".lower()

    def rank(r: dict) -> float:
        s = fuzz.token_set_ratio(hay_q, f"{r['title']} {' '.join(r['authors'])}".lower())
        text = f"{r['title']} {r.get('subtitle') or ''} {r.get('series_name') or ''}".lower()
        if re.search(r"graphic novel|comic|manga|hörbuch|audio|coloring|malbuch|sammelband", text):
            s -= 25  # andere Ausgabeform → nicht als Reihe des Romans übernehmen
        if r.get("page_count"):
            s += 5
        if r.get("series_name"):
            s += 3
        return s

    best = max(results, key=rank)
    if clean_isbn(isbn) and best.get("isbn") == clean_isbn(isbn):
        return best
    title_score = fuzz.token_set_ratio(title.lower(), best["title"].lower())
    author_score = fuzz.token_set_ratio((author or "").lower(), " ".join(best.get("authors") or []).lower())
    return best if title_score >= 85 and (not author or author_score >= 75) and rank(best) >= 80 else None


# ---------------- Cover ----------------
async def url_is_image(client: httpx.AsyncClient, url: str) -> bool:
    from cover_store import download_image
    return await download_image(client, url) is not None


async def find_cover(client: httpx.AsyncClient, title: str, authors: list[str], isbn: Optional[str], google_id: Optional[str] = None) -> Optional[str]:
    """Cover in allen Quellen suchen (ISBN zuerst, dann Titel+Autor). Nur echte Bilder zurückgeben."""
    isbn = clean_isbn(isbn)
    candidates: list[str] = []
    if isbn:
        candidates += [f"https://portal.dnb.de/opac/mvb/cover?isbn={isbn}", f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false"]
    if google_id and re.fullmatch(r"[A-Za-z0-9_-]{10,14}", google_id):
        candidates.append(f"https://books.google.com/books/content?id={google_id}&printsec=frontcover&img=1&zoom=2&source=gbs_api")
    for url in candidates:
        if await url_is_image(client, url):
            return url
    author = authors[0] if authors else ""
    query = f"{title} {author}".strip()
    google, ol, dnb = await asyncio.gather(
        google_search(client, f"intitle:{title}" + (f" inauthor:{author}" if author else ""), None, 0, 5),
        open_library_search(client, query, None, 0, 5),
        dnb_lookup(client, title, author, None),
        return_exceptions=True,
    )
    pool = [*(google if isinstance(google, list) else []), *(ol if isinstance(ol, list) else [])]
    pool = [i for i in pool if isinstance(i, dict)]
    if isinstance(dnb, dict):
        pool.append(dnb)
    hay_q = f"{title} {author}".lower()
    pool.sort(key=lambda i: -fuzz.token_set_ratio(hay_q, f"{i['title']} {' '.join(i['authors'])}".lower()))
    for item in pool:
        if fuzz.token_set_ratio(hay_q, f"{item['title']} {' '.join(item['authors'])}".lower()) < 70:
            break
        if item.get("cover_url") and await url_is_image(client, item["cover_url"]):
            return item["cover_url"]
    return None


# ---------------- Reihen-Erkennung ----------------
async def find_series(client: httpx.AsyncClient, book: dict) -> tuple[Optional[str], Optional[float]]:
    """Reihe für ein Buch bestimmen: Titel-Heuristik → DNB (490) → Google seriesInfo."""
    title = book.get("title") or ""
    authors = book.get("authors") or []
    name, part = series_from_title(title)
    if name:
        return name, part
    dnb = await dnb_lookup(client, title, authors[0] if authors else None, book.get("isbn"))
    if dnb and dnb.get("series_name") and dnb.get("series_part") is not None:
        # Publisher imprints such as „dtv“/„Reclam“ are not narrative series.
        if re.search(r"^(dtv|reclam|suhrkamp|rowohlt|heyne|piper|goldmann|rororo|insel|bastei|diogenes)(\b|$)", dnb["series_name"], re.I):
            return None, part
        return dnb["series_name"], dnb.get("series_part") if dnb.get("series_part") is not None else part
    gid = book.get("google_id")
    if gid and re.fullmatch(r"[A-Za-z0-9_-]{10,14}", gid):
        vol = await google_volume(client, gid)
        if vol and vol.get("series_name") and vol.get("series_part") is not None:
            return vol["series_name"], vol["series_part"]
    return None, part
