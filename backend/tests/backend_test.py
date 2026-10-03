"""Pytest backend regression for search, covers, CRUD, sessions, stats, isolation."""

import io
import os
import time
import uuid

import pytest
import requests
from PIL import Image


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL.rstrip('/')}/api"
PASSWORD = "BookShelf-Update-2026!"


def _register_and_token(email: str, name: str) -> str:
    res = requests.post(f"{API}/auth/register", json={"name": name, "email": email, "password": PASSWORD}, timeout=20)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["user"]["email"] == email.lower()
    assert isinstance(data["token"], str) and len(data["token"]) > 10
    return data["token"]


@pytest.fixture(scope="session")
def users_headers():
    # Modules: auth + account-isolation test setup
    p_mail = f"update-primary-{uuid.uuid4().hex[:8]}@bookshelf.example"
    s_mail = f"update-secondary-{uuid.uuid4().hex[:8]}@bookshelf.example"
    primary = {"Authorization": f"Bearer {_register_and_token(p_mail, 'Primary User')}"}
    secondary = {"Authorization": f"Bearer {_register_and_token(s_mail, 'Secondary User')}"}
    return {"primary": primary, "secondary": secondary}


@pytest.fixture()
def cleanup_books(users_headers):
    # Modules: books/covers/sessions fixtures cleanup
    created = []
    yield created
    for book_id in created:
        requests.delete(f"{API}/books/{book_id}", headers=users_headers["primary"], timeout=10)


def _create_book(headers: dict, **overrides) -> dict:
    payload = {
        "title": f"TEST_{uuid.uuid4().hex[:10]}",
        "authors": ["QA Bot"],
        "status": "to_read",
        "ownership": "owned",
        "progress_type": "pages",
        "page_count": 120,
    }
    payload.update(overrides)
    res = requests.post(f"{API}/books", headers=headers, json=payload, timeout=20)
    assert res.status_code == 200, res.text
    return res.json()


def _poll_job(job_id: str, headers: dict, timeout: int = 120) -> dict:
    deadline = time.time() + timeout
    last = {}
    while time.time() < deadline:
        res = requests.get(f"{API}/jobs/{job_id}", headers=headers, timeout=20)
        assert res.status_code == 200, res.text
        last = res.json()
        if last.get("status") in ("done", "error"):
            return last
        time.sleep(1)
    pytest.fail(f"Job timeout: {last}")


def _jpeg_bytes(width=70, height=110) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=(120, 80, 40)).save(buf, format="JPEG")
    return buf.getvalue()


def test_auth_login_and_me(users_headers):
    # Modules: auth flow
    me = requests.get(f"{API}/auth/me", headers=users_headers["primary"], timeout=20)
    assert me.status_code == 200, me.text
    data = me.json()
    assert data["user_id"].startswith("user_")
    assert "_id" not in data


def test_search_live_german_and_sources(users_headers):
    # Modules: multi-source search + source status
    res = requests.get(
        f"{API}/search",
        headers=users_headers["primary"],
        params={"q": "10 Blind Dates für die große Liebe", "lang": "de"},
        timeout=40,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data.get("items"), list)
    assert isinstance(data.get("sources"), dict)
    assert "dnb" in data["sources"]
    assert any("10 blind dates" in (i.get("title") or "").lower() for i in data["items"])


def test_search_pagination_start_20(users_headers):
    # Modules: search pagination merge
    res = requests.get(
        f"{API}/search",
        headers=users_headers["primary"],
        params={"q": "Harry Potter", "lang": "de", "start": 20},
        timeout=40,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data.get("items"), list)
    assert "next_start" in data
    assert any("dnb" in (item.get("sources") or []) for item in data["items"])


def test_search_isbn_hyphen_normalization(users_headers):
    # Modules: search isbn normalization
    res = requests.get(
        f"{API}/search",
        headers=users_headers["primary"],
        params={"q": "978-3-453-27378-7", "lang": "de"},
        timeout=40,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert isinstance(data.get("items"), list)
    assert all("result_key" in i for i in data["items"])


def test_series_detection_and_non_detection(users_headers, cleanup_books):
    # Modules: title-based series parser regression
    no_series = _create_book(users_headers["primary"], title="Berlin 24: Ein Tag", page_count=200)
    cleanup_books.append(no_series["id"])
    assert no_series.get("series_name") in (None, "")

    with_series = _create_book(users_headers["primary"], title="Titel (Meine Reihe, Band 2)")
    cleanup_books.append(with_series["id"])
    assert with_series.get("series_name") == "Meine Reihe"
    assert with_series.get("series_part") == 2


def test_wishlist_ownership_transitions(users_headers, cleanup_books):
    # Modules: status/ownership transition rules
    created = _create_book(users_headers["primary"], status="wishlist", ownership="owned")
    cleanup_books.append(created["id"])
    assert created["status"] == "to_read"

    book2 = _create_book(users_headers["primary"], status="wishlist", ownership="not_owned")
    cleanup_books.append(book2["id"])
    assert book2["status"] == "wishlist"

    patched = requests.patch(
        f"{API}/books/{book2['id']}",
        headers=users_headers["primary"],
        json={"ownership": "borrowed"},
        timeout=20,
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["status"] == "to_read"


def test_create_validation_rejects_invalid(users_headers):
    # Modules: pydantic/input validation
    bad_title = requests.post(
        f"{API}/books",
        headers=users_headers["primary"],
        json={"title": "", "status": "to_read", "ownership": "owned"},
        timeout=20,
    )
    assert bad_title.status_code == 422

    bad_pages = requests.post(
        f"{API}/books",
        headers=users_headers["primary"],
        json={"title": "TEST_NEG", "status": "to_read", "ownership": "owned", "page_count": -1},
        timeout=20,
    )
    assert bad_pages.status_code == 422


def test_books_pagination_over_40_and_counts(users_headers, cleanup_books):
    # Modules: pagination + summary/counts accuracy baseline
    category = f"TESTCAT_{uuid.uuid4().hex[:6]}"
    for i in range(42):
        b = _create_book(users_headers["primary"], title=f"TEST_PAGE_{i}_{uuid.uuid4().hex[:4]}", categories=[category])
        cleanup_books.append(b["id"])

    res = requests.get(
        f"{API}/books",
        headers=users_headers["primary"],
        params={"category": category, "skip": 0, "limit": 40, "scope": "all"},
        timeout=25,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert len(data["items"]) == 40
    assert data["total"] >= 42
    assert data["has_more"] is True
    assert data["next_skip"] == 40
    assert "summary" in data and "counts" in data
    assert all("_id" not in item for item in data["items"])


def test_private_cover_upload_and_cross_user_access_blocked(users_headers, cleanup_books):
    # Modules: private cover storage + ownership guard
    book = _create_book(users_headers["primary"])
    cleanup_books.append(book["id"])

    files = {"file": ("cover.jpg", io.BytesIO(_jpeg_bytes()), "image/jpeg")}
    up = requests.post(f"{API}/books/{book['id']}/cover", headers=users_headers["primary"], files=files, timeout=40)
    assert up.status_code == 200, up.text
    updated = up.json()
    assert updated["cover_url"].startswith("/api/covers/")

    own = requests.get(f"{BASE_URL.rstrip('/')}{updated['cover_url']}", headers=users_headers["primary"], timeout=40)
    assert own.status_code == 200
    assert own.headers.get("content-type", "").startswith("image/jpeg")
    assert own.headers.get("etag")

    other = requests.get(f"{BASE_URL.rstrip('/')}{updated['cover_url']}", headers=users_headers["secondary"], timeout=20)
    assert other.status_code == 404


def test_cover_upload_rejects_invalid_image(users_headers, cleanup_books):
    # Modules: cover validation (invalid/unsafe image)
    book = _create_book(users_headers["primary"])
    cleanup_books.append(book["id"])
    files = {"file": ("not-image.txt", io.BytesIO(b"not image"), "text/plain")}
    up = requests.post(f"{API}/books/{book['id']}/cover", headers=users_headers["primary"], files=files, timeout=20)
    assert up.status_code == 400


def test_sessions_client_id_dedup_and_delete_subtracts(users_headers, cleanup_books):
    # Modules: reading sessions idempotency + subtraction logic
    book = _create_book(users_headers["primary"], page_count=0, progress_type="percent")
    cleanup_books.append(book["id"])

    client_id = f"client-{uuid.uuid4().hex[:10]}"
    payload = {"seconds": 90, "client_id": client_id, "progress_percent": 12}
    s1 = requests.post(f"{API}/books/{book['id']}/sessions", headers=users_headers["primary"], json=payload, timeout=20)
    assert s1.status_code == 200, s1.text
    assert s1.json()["book"]["reading_seconds"] == 90

    s2 = requests.post(f"{API}/books/{book['id']}/sessions", headers=users_headers["primary"], json=payload, timeout=20)
    assert s2.status_code == 200, s2.text
    assert s2.json()["book"]["reading_seconds"] == 90

    sid = s1.json()["session"]["id"]
    d1 = requests.delete(f"{API}/books/{book['id']}/sessions/{sid}", headers=users_headers["primary"], timeout=20)
    assert d1.status_code == 200, d1.text
    assert d1.json()["book"]["reading_seconds"] == 0


@pytest.mark.parametrize("period", ["all", "month", "quarter", "year"])
def test_stats_periods(users_headers, period):
    # Modules: stats period switch
    res = requests.get(f"{API}/stats", headers=users_headers["primary"], params={"period": period}, timeout=20)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["period"] == period
    assert "summary" in data and "buckets" in data and "totals" in data


def test_import_csv_returns_job_and_duplicates_skipped(users_headers, cleanup_books):
    # Modules: csv import job + duplicate skip
    unique_title = f"TEST_IMPORT_{uuid.uuid4().hex[:8]}"
    csv_body = (
        "Title;Author;Exclusive Shelf;Number of Pages\n"
        f"{unique_title};Autor Eins;to-read;111\n"
    ).encode("utf-8")
    files = {"file": ("import.csv", io.BytesIO(csv_body), "text/csv")}

    first = requests.post(f"{API}/import/csv", headers=users_headers["primary"], files=files, timeout=30)
    assert first.status_code == 200, first.text
    job1 = _poll_job(first.json()["job_id"], users_headers["primary"])
    assert job1["status"] == "done"

    files2 = {"file": ("import.csv", io.BytesIO(csv_body), "text/csv")}
    second = requests.post(f"{API}/import/csv", headers=users_headers["primary"], files=files2, timeout=30)
    assert second.status_code == 200, second.text
    job2 = _poll_job(second.json()["job_id"], users_headers["primary"])
    assert job2["status"] == "done"
    assert job2.get("skipped", 0) >= 1

    listed = requests.get(f"{API}/books", headers=users_headers["primary"], params={"q": unique_title, "scope": "all"}, timeout=20)
    assert listed.status_code == 200
    payload = listed.json()
    items = payload.get("items", payload) if isinstance(payload, dict) else payload
    for b in items:
        cleanup_books.append(b["id"])


def test_isolation_books_not_visible_to_other_user(users_headers, cleanup_books):
    # Modules: user isolation across endpoints
    book = _create_book(users_headers["primary"], title=f"TEST_ISO_{uuid.uuid4().hex[:6]}")
    cleanup_books.append(book["id"])

    own = requests.get(f"{API}/books/{book['id']}", headers=users_headers["primary"], timeout=20)
    assert own.status_code == 200
    foreign = requests.get(f"{API}/books/{book['id']}", headers=users_headers["secondary"], timeout=20)
    assert foreign.status_code == 404
