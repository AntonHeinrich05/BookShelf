"""Import (Bookshelf-ZIP, Goodreads/Generic-CSV, Kindle-JSON) und CSV-Export."""
import asyncio
import csv
import io
import json
import logging
import re
import uuid
import zipfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from auth_utils import get_current_user
from database import db
from jobs import create_job, finish_job, update_job
from models import User, now_iso
from routers.books import normalize
from routers.enrich import detect_series, fix_covers
from routers.taxonomy import load_books
from sources import series_from_title

logger = logging.getLogger("bookshelf.import")

router = APIRouter(tags=["import"])

STATUS_DE = {"wunschliste": "wishlist", "zu lesen": "to_read", "lesen": "reading", "fertiggestellt": "finished", "abgebrochen": "abandoned",
             "to-read": "to_read", "currently-reading": "reading", "read": "finished", "wishlist": "wishlist", "finished": "finished", "reading": "reading"}
FORMAT_DE = {"ebuch": "ebook", "ebook": "ebook", "e-book": "ebook", "kindle edition": "ebook", "kindle": "ebook", "hörbuch": "audiobook", "hoerbuch": "audiobook",
             "audiobook": "audiobook", "audible audio": "audiobook", "taschenbuch": "book", "hardcover": "book", "paperback": "book", "buch": "book"}
OWN_DE = {"besessen": "owned", "im besitz": "owned", "owned": "owned", "ausgeliehen": "borrowed", "borrowed": "borrowed", "nicht besessen": "not_owned", "nicht im besitz": "not_owned"}


def parse_date(value: Optional[str]) -> Optional[str]:
    value = (value or "").strip()
    if not value:
        return None
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(value[:19], fmt).date().isoformat()
        except ValueError:
            continue
    return None


def to_int(value) -> Optional[int]:
    try:
        n = int(float(str(value).strip().replace(",", ".")))
        return n or None
    except (TypeError, ValueError):
        return None


def rating_of(value) -> int:
    m = re.match(r"\s*(\d+(?:\.\d+)?)", str(value or ""))
    return max(0, min(5, round(float(m.group(1))))) if m else 0


def norm_key(title: str, author: str = "") -> str:
    return re.sub(r"[^a-z0-9]", "", f"{title} {author.split(',')[0] if author else ''}".lower())[:80]


def google_cover(google_id: Optional[str]) -> Optional[str]:
    if google_id and re.fullmatch(r"[A-Za-z0-9_-]{10,14}", google_id):
        return f"https://books.google.com/books/content?id={google_id}&printsec=frontcover&img=1&zoom=1&source=gbs_api"
    return None


class Importer:
    def __init__(self, user_id: str, existing: list[dict], job_id: Optional[str] = None, total: int = 0):
        self.user_id = user_id
        self.job_id = job_id
        self.total = total
        self.processed = 0
        self.new_ids: set[str] = set()
        self.keys = set()
        for b in existing:
            for k in (b.get("google_id"), b.get("asin"), b.get("isbn")):
                if k:
                    self.keys.add(k)
            self.keys.add(norm_key(b["title"], (b.get("authors") or [""])[0]))
        self.added, self.skipped, self.failed = 0, 0, []

    async def progress(self, force: bool = False):
        self.processed += 1
        if self.job_id and (force or self.processed % 3 == 0 or self.processed == self.total):
            await update_job(self.job_id, phase="import", total=self.total, done=self.processed, added=self.added, skipped=self.skipped, failed_count=len(self.failed))

    def seen(self, doc: dict) -> bool:
        ks = [k for k in (doc.get("google_id"), doc.get("asin"), doc.get("isbn")) if k] + [norm_key(doc["title"], (doc.get("authors") or [""])[0])]
        if any(k in self.keys for k in ks):
            return True
        self.keys.update(ks)
        return False

    async def add(self, doc: dict, hint=None):
        try:
            if not doc.get("title"):
                self.failed.append("Eintrag ohne Titel übersprungen")
                return
            if self.seen(doc):
                self.skipped += 1
                return
            # Reihe aus dem Titel ableiten, wenn die Quelle keine liefert („Reihe 2: Titel", „Titel (Band 3)")
            if not doc.get("series_name"):
                name, part = series_from_title(doc["title"])
                if name:
                    doc["series_name"], doc["series_part"] = name, part if part is not None else doc.get("series_part")
            now = now_iso()
            base = {"authors": [], "status": "to_read", "format": "book", "ownership": "owned", "progress_type": "pages", "current_page": 0,
                    "progress_percent": 0, "rating": 0, "marked": False, "places": [], "categories": [], "collections": [], "reading_seconds": 0, "read_count": 0}
            full = await normalize({**base, **doc, "id": str(uuid.uuid4()), "user_id": self.user_id, "created_at": now, "updated_at": now}, self.user_id, hint)
            await db.books.insert_one({**full})
            self.new_ids.add(full["id"])
            self.added += 1
        finally:
            await self.progress()

    def result(self):
        return {"added": self.added, "skipped": self.skipped, "failed": self.failed[:50], "failed_count": len(self.failed)}


def read_csv(data: bytes) -> list[dict]:
    text = data.decode("utf-8-sig", errors="replace")
    return list(csv.DictReader(io.StringIO(text)))


async def import_bookshelf_zip(user_id: str, data: bytes, job_id: Optional[str] = None) -> Importer:
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Keine gültige ZIP-Datei")
    books_rows, history, collections = [], [], []
    for name in zf.namelist():
        base = name.lower().rsplit("/", 1)[-1]
        if not base.endswith(".csv"):
            continue
        rows = read_csv(zf.read(name))
        if "-books-" in base or base == "books.csv":
            books_rows = rows
        elif "reading_history" in base:
            history = rows
        elif "collections" in base:
            collections = rows
    if not books_rows:
        raise HTTPException(status_code=400, detail="Keine Bookshelf-Books-CSV in der ZIP gefunden")
    hist_by_book: dict[str, list[dict]] = {}
    for h in history:
        hist_by_book.setdefault(h.get("Book ID", ""), []).append(h)
    # Collections-CSV enthält alles: Systemlisten, Autoren, Serien, Orte, Sammlungen, Kategorien
    series_by_book: dict[str, str] = {}
    places_by_book: dict[str, list[str]] = {}
    coll_by_book: dict[str, list[str]] = {}
    cats_by_book: dict[str, list[str]] = {}
    for c in collections:
        ctype = (c.get("Type") or "").strip().lower()
        title = (c.get("Title") or "").strip()
        ids = [i.strip() for i in (c.get("Book IDs") or "").split(";") if i.strip()]
        for bid in ids:
            if ctype in ("serie", "series", "reihe"):
                series_by_book.setdefault(bid, title)
            elif ctype in ("orte", "places", "ort"):
                places_by_book.setdefault(bid, []).append(title)
            elif ctype in ("sammlungen", "collections", "sammlung"):
                coll_by_book.setdefault(bid, []).append(title)
            elif ctype in ("kategorien", "categories", "genre", "genres"):
                cats_by_book.setdefault(bid, []).append(title)
    imp = Importer(user_id, await load_books(user_id), job_id, len(books_rows))
    for row in books_rows:
        try:
            bid = row.get("ID") or ""
            runs = sorted(hist_by_book.get(bid, []), key=lambda h: to_int(h.get("Read Number")) or 0)
            last = runs[-1] if runs else {}
            status = STATUS_DE.get((row.get("Reading Status") or last.get("Status") or "").strip().lower(), "to_read")
            rating = rating_of(row.get("Rating")) or rating_of(last.get("Rating"))
            is_google = (row.get("Book Source") or "").lower() == "googlebooks"
            pages = to_int(row.get("Page Count"))
            pct = float(last.get("Percent Complete") or 0) if last else 0
            raw_cats = [c.strip() for c in re.split(r"[;,]", row.get("Category") or "") if c.strip()] + cats_by_book.get(bid, [])
            title = (row.get("Title") or "").strip()
            series_name = series_by_book.get(bid)
            part = None
            m = re.search(r"(?:Band|Teil|Bd\.|#|Vol\.?)\s*(\d+(?:[.,]\d)?)", title, re.I)
            if m:
                part = float(m.group(1).replace(",", "."))
            doc = {
                "title": title,
                "authors": [a.strip() for a in re.split(r"[;,]|\s&\s", row.get("Author") or "") if a.strip()],
                "isbn": (row.get("ISBN-13") or row.get("ISBN-10") or "").strip() or None,
                "asin": (row.get("ASIN") or "").strip() or None,
                "publisher": (row.get("Publisher") or "").strip() or None,
                "published_year": to_int(row.get("Year Published")),
                "page_count": pages,
                "google_id": bid if is_google else None,
                "cover_url": google_cover(bid) if is_google else None,
                "format": FORMAT_DE.get((row.get("Format") or "").strip().lower(), "book"),
                "ownership": OWN_DE.get((row.get("Ownership Status") or "").strip().lower(), "owned"),
                "status": status,
                "marked": (row.get("Is Favorite") or "").strip().lower() in ("yes", "ja", "true", "1"),
                "start_date": parse_date(row.get("Start Date")) or parse_date(last.get("Start Date")),
                "end_date": parse_date(row.get("End Date")) or parse_date(last.get("End Date")),
                "rating": rating,
                "categories": [],  # → aus Google-Kategorien automatisch ein deutsches Genre ableiten
                "collections": coll_by_book.get(bid, []),
                "places": places_by_book.get(bid, []),
                "series_name": series_name,
                "series_part": part if series_name else None,
                "read_count": len([r for r in runs if STATUS_DE.get((r.get("Status") or "").lower()) == "finished"]),
                "current_page": round(pct * pages) if pages and 0 < pct <= 1 else 0,
                "source": "bookshelf",
            }
            if doc["status"] == "finished" and not doc["end_date"]:
                doc["end_date"] = parse_date(row.get("Date Added"))
            await imp.add(doc, raw_cats)
        except Exception as exc:  # einzelne kaputte Zeile darf den Import nicht stoppen
            imp.failed.append(f"{row.get('Title') or '?'}: {exc}")
    return imp


async def import_generic_csv(user_id: str, data: bytes, job_id: Optional[str] = None) -> Importer:
    rows = read_csv(data)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV ist leer")
    imp = Importer(user_id, await load_books(user_id), job_id, len(rows))

    def col(row, *names):
        for n in names:
            for k, v in row.items():
                if k and k.strip().lower() == n.lower() and v is not None and str(v).strip():
                    return str(v).strip()
        return ""

    for row in rows:
        try:
            shelf = col(row, "Exclusive Shelf", "Reading Status", "Status", "Shelf").lower()
            status = STATUS_DE.get(shelf, "finished" if col(row, "Date Read") else "to_read")
            isbn = re.sub(r"[^0-9Xx]", "", col(row, "ISBN13", "ISBN-13", "ISBN", "ISBN-10"))
            doc = {
                "title": col(row, "Title", "Titel"),
                "authors": [a.strip() for a in re.split(r"[;,]|\s&\s", col(row, "Author", "Autor", "Authors")) if a.strip()],
                "isbn": isbn or None,
                "asin": col(row, "ASIN") or None,
                "publisher": col(row, "Publisher", "Verlag") or None,
                "published_year": to_int(col(row, "Year Published", "Original Publication Year", "Jahr")),
                "page_count": to_int(col(row, "Number of Pages", "Page Count", "Pages", "Seiten")),
                "format": FORMAT_DE.get(col(row, "Binding", "Format").lower(), "book"),
                "status": status,
                "rating": rating_of(col(row, "My Rating", "Rating", "Bewertung")),
                "start_date": parse_date(col(row, "Start Date", "Date Started")),
                "end_date": parse_date(col(row, "Date Read", "End Date", "Gelesen am")),
                "categories": [c.strip() for c in re.split(r"[;,]", col(row, "Genre", "Category", "Kategorie")) if c.strip()],
                "collections": [c.strip() for c in col(row, "Bookshelves", "Collections", "Sammlungen").split(",") if c.strip() and c.strip() not in ("to-read", "read", "currently-reading")],
                "notes": col(row, "My Review", "Private Notes", "Notes", "Notizen") or None,
                "source": "csv",
            }
            await imp.add(doc)
        except Exception as exc:
            imp.failed.append(f"{row.get('Title') or '?'}: {exc}")
    return imp


async def import_kindle_json(user_id: str, data: bytes, job_id: Optional[str] = None) -> Importer:
    try:
        payload = json.loads(data.decode("utf-8-sig"))
    except Exception:
        raise HTTPException(status_code=400, detail="Keine gültige Kindle-JSON-Datei")
    items = payload.get("itemsList") if isinstance(payload, dict) else payload
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="Unerwartetes Kindle-Format")
    imp = Importer(user_id, await load_books(user_id), job_id, len(items))
    for it in items:
        try:
            if (it.get("resourceType") or "EBOOK").upper() not in ("EBOOK", "EBOOK_SAMPLE", "BOOK"):
                imp.skipped += 1
                continue
            pct = it.get("percentageRead")
            pct = float(pct) if pct not in (None, "") else 0
            authors = it.get("authors") or []
            if isinstance(authors, str):
                authors = [authors]
            authors = [re.sub(r":$", "", a).strip() for a in authors for a in a.split(":") if a.strip()]
            # Kindle liefert Autoren oft als "Nachname, Vorname"
            authors = [" ".join(reversed([p.strip() for p in a.split(",")])) if a.count(",") == 1 else a for a in authors]
            status = "finished" if pct >= 98 else "reading" if pct > 2 else "to_read"
            doc = {
                "title": re.sub(r"\s*\((German|English) Edition\)$", "", it.get("title") or "").strip(),
                "authors": authors,
                "asin": it.get("asin"),
                "cover_url": it.get("productUrl") or it.get("imageUrl"),
                "format": "ebook",
                "ownership": "owned",
                "status": status,
                "progress_type": "percent",
                "progress_percent": round(pct),
                "source": "kindle",
            }
            await imp.add(doc)
        except Exception as exc:
            imp.failed.append(f"{it.get('title') or '?'}: {exc}")
    return imp


IMPORTERS = {"bookshelf": import_bookshelf_zip, "csv": import_generic_csv, "kindle": import_kindle_json}


async def run_import_job(kind: str, user_id: str, data: bytes, job_id: str):
    """Import im Hintergrund: Bücher anlegen → fehlende Cover suchen → Reihen erkennen. Fortschritt im Job."""
    try:
        imp = await IMPORTERS[kind](user_id, data, job_id)
        await update_job(job_id, **imp.result(), done=imp.total, total=imp.total)
        if imp.new_ids:
            await fix_covers(user_id, job_id, imp.new_ids)
            await detect_series(user_id, job_id, imp.new_ids)
        await finish_job(job_id)
    except HTTPException as exc:
        await finish_job(job_id, exc.detail)
    except Exception as exc:
        logger.exception("import failed")
        await finish_job(job_id, f"Import fehlgeschlagen: {exc}")


@router.post("/import/{kind}")
async def import_file(kind: str, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    if kind not in IMPORTERS:
        raise HTTPException(status_code=404, detail="Unbekannter Import-Typ")
    data = await file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Datei ist zu groß (max. 25 MB)")
    # Datei vorab validieren, damit Fehler sofort (nicht erst im Job) sichtbar sind
    if kind == "bookshelf":
        try:
            zipfile.ZipFile(io.BytesIO(data))
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Keine gültige ZIP-Datei")
    elif kind == "kindle":
        try:
            json.loads(data.decode("utf-8-sig"))
        except Exception:
            raise HTTPException(status_code=400, detail="Keine gültige Kindle-JSON-Datei")
    elif not read_csv(data):
        raise HTTPException(status_code=400, detail="CSV ist leer")
    job_id = await create_job(user.user_id, "import")
    asyncio.create_task(run_import_job(kind, user.user_id, data, job_id))
    return {"job_id": job_id}


@router.get("/export/csv")
async def export_csv(user: User = Depends(get_current_user)):
    books = await load_books(user.user_id)
    out = io.StringIO()
    cols = ["title", "authors", "isbn", "asin", "publisher", "published_year", "page_count", "format", "ownership", "status", "rating",
            "start_date", "end_date", "series_name", "series_part", "categories", "collections", "places", "reading_seconds", "notes", "cover_url", "google_id"]
    w = csv.writer(out)
    w.writerow(cols)
    for b in books:
        w.writerow(["; ".join(b.get(c) or []) if isinstance(b.get(c), list) else (b.get(c) if b.get(c) is not None else "") for c in cols])
    out.seek(0)
    return StreamingResponse(iter([out.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=bookshelf-export.csv"})
