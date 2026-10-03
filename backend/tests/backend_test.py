"""BookShelf backend API tests – aligned with current app features (Jan 2026)."""
import io
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("REACT_APP_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL/REACT_APP_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

SEED_EMAIL = "lara.test@example.com"
SEED_PASS = "test1234"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def seed_token():
    r = requests.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASS}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def seed_headers(seed_token):
    return {"Authorization": f"Bearer {seed_token}"}


# ---------- auth ----------
class TestAuth:
    def test_login_seed(self, seed_token):
        assert isinstance(seed_token, str) and len(seed_token) > 10

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401


# ---------- search (multi-source merged) ----------
class TestSearch:
    def test_search_dnb_title(self, seed_headers):
        r = requests.get(f"{API}/search", headers=seed_headers,
                         params={"q": "10 Blind Dates für die große Liebe"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and len(data["items"]) >= 1
        titles = [i["title"].lower() for i in data["items"]]
        assert any("10 blind dates" in t for t in titles), f"Titles: {titles[:5]}"
        # at least one item should list dnb as a source
        has_dnb = any("dnb" in (i.get("sources") or []) for i in data["items"])
        assert has_dnb, f"No DNB source found: {[i.get('sources') for i in data['items'][:5]]}"

    def test_search_throne_of_glass(self, seed_headers):
        r = requests.get(f"{API}/search", headers=seed_headers,
                         params={"q": "throne of glass", "lang": "de"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["items"]) >= 2
        item = data["items"][0]
        assert "sources" in item and isinstance(item["sources"], list)
        assert "cover_url" in item  # key must exist (may be None)

    def test_search_cover_endpoint(self, seed_headers):
        r = requests.get(f"{API}/search/cover", headers=seed_headers,
                         params={"title": "Harry Potter und der Stein der Weisen", "author": "Rowling"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "cover_url" in data  # may be None or url
        assert data["cover_url"] is None or isinstance(data["cover_url"], str)


# ---------- stats (period-based) ----------
class TestStats:
    @pytest.mark.parametrize("period", ["month", "quarter", "year", "all"])
    def test_stats_periods(self, seed_headers, period):
        r = requests.get(f"{API}/stats", headers=seed_headers, params={"period": period}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["period"] == period
        for key in ("period", "start", "summary", "buckets", "by_rating", "rated_books", "totals"):
            assert key in data, f"missing key {key}"
        assert isinstance(data["buckets"], list)
        if data["buckets"]:
            b0 = data["buckets"][0]
            for k in ("label", "books", "pages", "hours"):
                assert k in b0

    def test_stats_invalid_period_falls_back_to_year(self, seed_headers):
        r = requests.get(f"{API}/stats", headers=seed_headers, params={"period": "foobar"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["period"] == "year"


# ---------- books filters ----------
class TestBooks:
    def test_overview_contains_series_none_and_covers_missing(self, seed_headers):
        r = requests.get(f"{API}/books/overview", headers=seed_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "series_none" in data
        assert "covers_missing" in data
        assert isinstance(data["series_none"], int)
        assert isinstance(data["covers_missing"], int)

    def test_books_filter_series_none(self, seed_headers):
        r = requests.get(f"{API}/books", headers=seed_headers, params={"series": "__none__"}, timeout=20)
        assert r.status_code == 200
        for b in r.json():
            assert not b.get("series_name"), f"book {b.get('title')} has series_name={b.get('series_name')}"

    def test_books_filter_rating(self, seed_headers):
        r = requests.get(f"{API}/books", headers=seed_headers, params={"rating": 5}, timeout=20)
        assert r.status_code == 200
        for b in r.json():
            assert b.get("rating") == 5

    def test_create_book_series_canonicalized(self, seed_headers):
        """New book with 'Throne of Glass 3: ...' should get series_name canonicalized."""
        payload = {"title": "Throne of Glass 3: Erbin des Feuers", "authors": ["Sarah J. Maas"], "status": "to_read"}
        r = requests.post(f"{API}/books", json=payload, headers=seed_headers, timeout=20)
        assert r.status_code == 200, r.text
        book = r.json()
        bid = book["id"]
        try:
            # series detected
            sname = (book.get("series_name") or "").lower()
            assert "throne of glass" in sname, f"series_name={book.get('series_name')!r}"
            assert book.get("series_part") == 3
        finally:
            requests.delete(f"{API}/books/{bid}", headers=seed_headers, timeout=10)


# ---------- jobs (background import / enrich) ----------
def _poll_job(job_id: str, headers: dict, timeout: float = 45.0) -> dict:
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        r = requests.get(f"{API}/jobs/{job_id}", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        last = r.json()
        if last.get("status") == "done":
            return last
        if last.get("status") == "error":
            pytest.fail(f"Job errored: {last}")
        time.sleep(1.0)
    pytest.fail(f"Job did not finish in {timeout}s, last={last}")


class TestJobs:
    def test_import_csv_job(self, seed_headers):
        csv_content = (
            "Title,Author,ISBN13,My Rating,Date Read,Exclusive Shelf,Number of Pages\n"
            f"TESTJOB Book {uuid.uuid4().hex[:6]},Test Author,,4,2025-01-10,read,250\n"
            f"TESTJOB Dup {uuid.uuid4().hex[:6]},Test Author,,,2025-02-10,to-read,180\n"
        )
        files = {"file": ("goodreads.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
        r = requests.post(f"{API}/import/csv", files=files, headers=seed_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "job_id" in data
        job = _poll_job(data["job_id"], seed_headers, timeout=60)
        # expected fields
        for k in ("phase", "total", "done", "added", "skipped", "covers_fixed", "series_found"):
            assert k in job, f"missing {k} in job: {job}"
        # Should have added at least 1 book out of 2 (or skipped if dup)
        assert job["total"] == 2
        # cleanup imported test books
        r2 = requests.get(f"{API}/books", headers=seed_headers, params={"q": "TESTJOB"}, timeout=15)
        for b in r2.json():
            if b["title"].startswith("TESTJOB"):
                requests.delete(f"{API}/books/{b['id']}", headers=seed_headers, timeout=10)

    def test_import_csv_duplicate_skipped(self, seed_headers):
        unique = f"TESTDUP {uuid.uuid4().hex[:6]}"
        csv = (
            "Title,Author,ISBN13,My Rating,Date Read,Exclusive Shelf,Number of Pages\n"
            f"{unique},A Author,,,2025-01-05,to-read,100\n"
        )
        files = {"file": ("gr.csv", io.BytesIO(csv.encode()), "text/csv")}
        r1 = requests.post(f"{API}/import/csv", files=files, headers=seed_headers, timeout=30)
        job1 = _poll_job(r1.json()["job_id"], seed_headers)
        assert job1["added"] >= 1
        # import same CSV again -> should be skipped (same title+author)
        files2 = {"file": ("gr.csv", io.BytesIO(csv.encode()), "text/csv")}
        r2 = requests.post(f"{API}/import/csv", files=files2, headers=seed_headers, timeout=30)
        job2 = _poll_job(r2.json()["job_id"], seed_headers)
        assert job2["skipped"] >= 1, f"Expected dup skip, got job={job2}"
        # cleanup
        r3 = requests.get(f"{API}/books", headers=seed_headers, params={"q": unique}, timeout=15)
        for b in r3.json():
            requests.delete(f"{API}/books/{b['id']}", headers=seed_headers, timeout=10)

    def test_import_bookshelf_invalid_zip(self, seed_headers):
        files = {"file": ("notazip.zip", io.BytesIO(b"not a zip"), "application/zip")}
        r = requests.post(f"{API}/import/bookshelf", files=files, headers=seed_headers, timeout=20)
        assert r.status_code == 400, r.text

    def test_enrich_jobs(self, seed_headers):
        for path in ("/enrich/covers", "/enrich/series", "/enrich/all"):
            r = requests.post(f"{API}{path}", headers=seed_headers, timeout=15)
            assert r.status_code == 200, f"{path}: {r.text}"
            data = r.json()
            assert "job_id" in data
            _poll_job(data["job_id"], seed_headers, timeout=60)

    def test_job_not_found(self, seed_headers):
        r = requests.get(f"{API}/jobs/does-not-exist-xyz", headers=seed_headers, timeout=10)
        assert r.status_code == 404
