"""Targeted regression tests for CSV fidelity, import normalization, cover durability, and proxy safety."""

import csv
import asyncio
import hashlib
import io
import json
import os
import sys
import uuid
import zipfile
from pathlib import Path

import pytest
import requests
from PIL import Image

sys.path.append(str(Path(__file__).resolve().parents[1]))

from cover_store import ensure_cover, store_cover  # noqa: E402
from database import db  # noqa: E402
from routers import imports as imports_router  # noqa: E402


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL.rstrip('/')}/api"
PASSWORD = "BookShelf-Update-2026!"
IMAGE_FIXTURE = Path(__file__).parent / "fixtures" / "dnb-cover.jpg"
LOOP = asyncio.new_event_loop()
asyncio.set_event_loop(LOOP)


def run(coro):
    return LOOP.run_until_complete(coro)


def _register_user() -> dict:
    email = f"targeted-{uuid.uuid4().hex[:10]}@bookshelf.example"
    res = requests.post(
        f"{API}/auth/register",
        json={"name": "Targeted QA", "email": email, "password": PASSWORD},
        timeout=30,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    return {
        "email": email,
        "user_id": data["user"]["user_id"],
        "headers": {"Authorization": f"Bearer {data['token']}"},
    }


def test_csv_export_import_roundtrip_json_array_fidelity():
    # Modules: import/export CSV roundtrip semantics with JSON-array cells
    src = _register_user()
    dst = _register_user()

    title = f"TEST_CSV_RICH_{uuid.uuid4().hex[:8]}"
    create_payload = {
        "title": title,
        "authors": ["Max Mustermann", "Nachname, Vorname"],
        "categories": ["Sci-Fi, Space", "Drama;Tragödie"],
        "collections": ["Sammlung, Alpha", "Beta;Gamma"],
        "places": ["Berlin, DE", "Köln;Innenstadt"],
        "series_name": "Meine Reihe, Spezial",
        "series_part": 2,
        "ownership": "borrowed",
        "status": "reading",
        "start_date": "2026-01-03",
        "end_date": "2026-02-04",
        "published_year": 2019,
        "page_count": 321,
        "audio_minutes": 91,
        "current_page": 123,
        "progress_percent": 38,
        "progress_type": "pages",
        "rating": 4,
        "marked": True,
        "read_count": 3,
        "reading_seconds": 812,
        "notes": "Notiz mit Komma, Semikolon; bleibt erhalten",
        "description": "Beschreibung mit Umlauten äöü und ; ,",
    }
    created = requests.post(f"{API}/books", headers=src["headers"], json=create_payload, timeout=30)
    assert created.status_code == 200, created.text
    created_book = created.json()

    exported = requests.get(f"{API}/export/csv", headers=src["headers"], timeout=40)
    assert exported.status_code == 200, exported.text
    csv_text = exported.text
    assert "cover_url" in csv_text
    assert "cover_data" not in csv_text

    rows = list(csv.DictReader(io.StringIO(csv_text)))
    row = next(r for r in rows if r.get("title") == title)

    exported_authors = json.loads(row["authors"])
    exported_categories = json.loads(row["categories"])
    exported_collections = json.loads(row["collections"])
    exported_places = json.loads(row["places"])

    assert "Nachname, Vorname" in exported_authors
    assert "Sci-Fi, Space" in exported_categories and "Drama;Tragödie" in exported_categories
    assert "Sammlung, Alpha" in exported_collections and "Beta;Gamma" in exported_collections
    assert "Berlin, DE" in exported_places and "Köln;Innenstadt" in exported_places

    imp = run(imports_router.import_generic_csv(dst["user_id"], csv_text.encode("utf-8")))
    assert imp.added >= 1

    imported = run(db.books.find_one({"user_id": dst["user_id"], "title": title}, {"_id": 0}))
    assert imported is not None
    assert imported["authors"] == create_payload["authors"]
    assert set(imported["categories"]) == set(create_payload["categories"])
    assert set(imported["collections"]) == set(create_payload["collections"])
    assert set(imported["places"]) == set(create_payload["places"])
    assert imported["series_name"] == create_payload["series_name"]
    assert int(imported["series_part"]) == create_payload["series_part"]
    assert imported["ownership"] == create_payload["ownership"]
    assert imported["status"] == create_payload["status"]
    assert imported["start_date"] == create_payload["start_date"]
    assert imported["end_date"] == create_payload["end_date"]
    assert imported["published_year"] == create_payload["published_year"]
    assert imported["page_count"] == create_payload["page_count"]
    assert imported["audio_minutes"] == create_payload["audio_minutes"]
    assert imported["current_page"] == create_payload["current_page"]
    assert imported["progress_percent"] == create_payload["progress_percent"]
    assert imported["rating"] == create_payload["rating"]
    assert imported["marked"] is True
    assert imported["read_count"] == create_payload["read_count"]
    assert imported["reading_seconds"] == create_payload["reading_seconds"]
    assert imported["notes"] == create_payload["notes"]
    assert imported["description"] == create_payload["description"]

    run(db.books.delete_many({"user_id": {"$in": [src["user_id"], dst["user_id"]]}, "title": {"$regex": "^TEST_CSV_RICH_"}}))


def test_import_generic_csv_normalization_load_calls_only_once(monkeypatch):
    # Modules: import performance normalization call-count behavior
    user = _register_user()
    call_counts = {"load_books": 0, "taxonomy": 0}

    real_load_books = imports_router.load_books
    real_taxonomy_items = imports_router.taxonomy_items

    async def spy_load_books(user_id):
        call_counts["load_books"] += 1
        return await real_load_books(user_id)

    async def spy_taxonomy_items(user_id, kind, books):
        call_counts["taxonomy"] += 1
        return await real_taxonomy_items(user_id, kind, books)

    monkeypatch.setattr(imports_router, "load_books", spy_load_books)
    monkeypatch.setattr(imports_router, "taxonomy_items", spy_taxonomy_items)

    header = ["Title", "Author", "Exclusive Shelf", "Number of Pages", "Genre", "Bookshelves"]
    rows = [";".join(header)]
    for i in range(160):
        rows.append(f"TEST_PERF_{i}_{uuid.uuid4().hex[:5]};Autor {i};to-read;{100 + (i % 200)};Testgenre;Sammlung A")
    csv_body = "\n".join(rows).encode("utf-8")

    imp = run(imports_router.import_generic_csv(user["user_id"], csv_body))
    assert imp.added == 160
    assert call_counts["load_books"] == 1
    assert call_counts["taxonomy"] == 4

    run(db.books.delete_many({"user_id": user["user_id"], "title": {"$regex": "^TEST_PERF_"}}))


def test_bookshelf_collections_type_genres_applies_to_all_assigned_books():
    # Modules: Bookshelf collections "Type Genres" to categories mapping integrity
    user = _register_user()
    unique = uuid.uuid4().hex[:6]
    bid1, bid2 = f"gid-{unique}-1", f"gid-{unique}-2"
    genre_name = f"TEST_GENRE_{unique}"

    books_csv = (
        "ID,Title,Author,Reading Status,Page Count\n"
        f"{bid1},TEST_BS_{unique}_1,Autor Eins,to-read,200\n"
        f"{bid2},TEST_BS_{unique}_2,Autor Zwei,read,310\n"
    )
    collections_csv = (
        "Type,Title,Book IDs\n"
        f"Genres,{genre_name},\"{bid1};{bid2}\"\n"
    )
    mem = io.BytesIO()
    with zipfile.ZipFile(mem, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("books.csv", books_csv)
        zf.writestr("collections.csv", collections_csv)

    imp = run(imports_router.import_bookshelf_zip(user["user_id"], mem.getvalue()))
    assert imp.added == 2

    imported = run(db.books.find({"user_id": user["user_id"], "title": {"$regex": f"^TEST_BS_{unique}_"}}, {"_id": 0}).to_list(10))
    assert len(imported) == 2
    for book in imported:
        assert genre_name in (book.get("categories") or [])

    run(db.books.delete_many({"user_id": user["user_id"], "title": {"$regex": f"^TEST_BS_{unique}_"}}))


def test_durable_known_cover_etag_304_and_binary_fixture_match():
    # Modules: durable cover API and ETag behavior on known fixture book
    known = _register_user()
    created = requests.post(f"{API}/books", headers=known["headers"], json={"title": "TEST_DNB_fixture", "authors": ["QA"]}, timeout=30)
    assert created.status_code == 200
    book = created.json()
    book_id = book["id"]
    run(store_cover(book, IMAGE_FIXTURE.read_bytes(), custom=True))

    r1 = requests.get(f"{API}/covers/{book_id}", headers=known["headers"], timeout=40)
    assert r1.status_code == 200, r1.text
    assert r1.headers.get("content-type", "").startswith("image/jpeg")
    etag = r1.headers.get("etag")
    assert etag

    expected = IMAGE_FIXTURE.read_bytes()
    assert len(expected) == 41646
    assert len(r1.content) == len(expected)
    assert hashlib.sha256(r1.content).hexdigest() == hashlib.sha256(expected).hexdigest()

    with Image.open(io.BytesIO(r1.content)) as img:
        assert img.size == (379, 599)

    r2 = requests.get(f"{API}/covers/{book_id}", headers={**known["headers"], "If-None-Match": etag}, timeout=40)
    assert r2.status_code == 304
    requests.delete(f"{API}/books/{book_id}", headers=known["headers"], timeout=20)


def test_ensure_cover_does_not_redownload_when_revision_exists(monkeypatch):
    # Modules: cover store short-circuit when persisted revision already exists
    user = _register_user()
    book_id = f"TEST_COVER_UNIT_{uuid.uuid4().hex[:8]}"
    seed = {
        "id": book_id,
        "user_id": user["user_id"],
        "title": "TEST unit cover",
        "authors": ["QA"],
        "status": "to_read",
        "format": "book",
        "ownership": "owned",
        "progress_type": "pages",
        "current_page": 0,
        "progress_percent": 0,
        "rating": 0,
        "marked": False,
        "places": [],
        "categories": ["Test"],
        "collections": [],
        "read_count": 0,
        "reading_seconds": 0,
        "created_at": "2026-10-03T00:00:00+00:00",
        "updated_at": "2026-10-03T00:00:00+00:00",
        "cover_url": "https://portal.dnb.de/opac/mvb/cover?isbn=9783846600917",
    }
    run(db.books.insert_one(seed))

    image = IMAGE_FIXTURE.read_bytes()
    current = run(store_cover(seed, image, custom=False))
    assert current.get("cover_revision")

    async def fail_download(*_args, **_kwargs):
        raise AssertionError("download_image must not be called when revision already exists")

    monkeypatch.setattr("cover_store.download_image", fail_download)
    stored = run(ensure_cover({"id": book_id, "user_id": user["user_id"]}))
    assert stored is not None
    assert bytes(stored["data"]) == image

    run(db.books.delete_many({"user_id": user["user_id"], "id": book_id}))
    run(db.covers.delete_many({"user_id": user["user_id"], "book_id": book_id}))


def test_custom_upload_survives_patch_with_stale_cover_url_and_enrich_covers():
    # Modules: upload persistence against stale form patches and cover enrich
    user = _register_user()
    title = f"TEST_CUSTOM_SURVIVE_{uuid.uuid4().hex[:8]}"
    created = requests.post(
        f"{API}/books",
        headers=user["headers"],
        json={"title": title, "authors": ["QA"], "status": "to_read", "ownership": "owned", "page_count": 100},
        timeout=30,
    )
    assert created.status_code == 200, created.text
    book = created.json()

    img = IMAGE_FIXTURE.read_bytes()
    up = requests.post(
        f"{API}/books/{book['id']}/cover",
        headers=user["headers"],
        files={"file": ("actual-cover.jpg", io.BytesIO(img), "image/jpeg")},
        timeout=40,
    )
    assert up.status_code == 200, up.text
    uploaded = up.json()
    assert uploaded.get("cover_custom") is True
    custom_cover = uploaded["cover_url"]

    before = requests.get(f"{BASE_URL.rstrip('/')}{custom_cover}", headers=user["headers"], timeout=40)
    assert before.status_code == 200
    before_bytes = before.content

    patched = requests.patch(
        f"{API}/books/{book['id']}",
        headers=user["headers"],
        json={"title": f"{title}_patched", "cover_url": "https://portal.dnb.de/opac/mvb/cover?isbn=9783846600917"},
        timeout=30,
    )
    assert patched.status_code == 200, patched.text
    after_patch = patched.json()
    assert after_patch["cover_url"] == custom_cover
    assert after_patch.get("cover_custom") is True

    enrich = requests.post(f"{API}/enrich/covers", headers=user["headers"], timeout=30)
    assert enrich.status_code == 200, enrich.text

    after = requests.get(f"{BASE_URL.rstrip('/')}{custom_cover}", headers=user["headers"], timeout=40)
    assert after.status_code == 200
    assert after.content == before_bytes

    requests.delete(f"{API}/books/{book['id']}", headers=user["headers"], timeout=30)


def test_cover_preview_rejects_localhost_arbitrary_hosts_and_non_image_content():
    # Modules: /cover-preview SSRF and content-type guardrails
    user = _register_user()

    bad_local = requests.get(
        f"{API}/cover-preview",
        headers=user["headers"],
        params={"url": "https://localhost/cover.jpg"},
        timeout=30,
    )
    assert bad_local.status_code == 400

    bad_host = requests.get(
        f"{API}/cover-preview",
        headers=user["headers"],
        params={"url": "https://example.com/cover.jpg"},
        timeout=30,
    )
    assert bad_host.status_code == 400

    non_image = requests.get(
        f"{API}/cover-preview",
        headers=user["headers"],
        params={"url": "https://d-nb.info"},
        timeout=30,
    )
    assert non_image.status_code in (404, 400)


def test_counts_regression_wishlist_exclusion_and_q_chip_retention():
    # Modules: counts regression for overview and q-filter ownership chips
    user = _register_user()
    headers = user["headers"]
    marker = f"TEST_COUNT_{uuid.uuid4().hex[:6]}"

    created_ids = []

    def create(**payload):
        res = requests.post(
            f"{API}/books",
            headers=headers,
            json={
                "title": payload.get("title"),
                "authors": payload.get("authors", ["Count Author"]),
                "status": payload.get("status", "to_read"),
                "ownership": payload.get("ownership", "owned"),
                "categories": payload.get("categories", ["CountCat"]),
                "series_name": payload.get("series_name"),
                "page_count": 120,
            },
            timeout=30,
        )
        assert res.status_code == 200, res.text
        created_ids.append(res.json()["id"])

    create(title=f"{marker} owned finished", status="finished", ownership="owned", categories=["CountCat"], series_name="CountSeries")
    create(title=f"{marker} borrowed reading", status="reading", ownership="borrowed", categories=["CountCat"], series_name="CountSeries")
    create(title=f"{marker} owned toread", status="to_read", ownership="owned", categories=["CountCat"]) 
    create(title=f"{marker} wishlist hidden", status="wishlist", ownership="not_owned", categories=["CountCat"], series_name="CountSeries")

    overview = requests.get(f"{API}/books/overview", headers=headers, timeout=30)
    assert overview.status_code == 200, overview.text
    ov = overview.json()
    cat = next((c for c in ov.get("categories", []) if c["name"] == "CountCat"), None)
    series = next((s for s in ov.get("series", []) if s["name"] == "CountSeries"), None)
    assert cat and cat["count"] == 3
    assert series and series["count"] == 2

    listed = requests.get(
        f"{API}/books",
        headers=headers,
        params={"q": marker, "limit": 40, "skip": 0, "scope": "library", "ownership": "owned"},
        timeout=30,
    )
    assert listed.status_code == 200, listed.text
    data = listed.json()
    assert data["total"] == 2
    assert data["counts"]["ownership"].get("owned") == 2
    assert data["counts"]["ownership"].get("borrowed") == 1

    for book_id in created_ids:
        requests.delete(f"{API}/books/{book_id}", headers=headers, timeout=20)
