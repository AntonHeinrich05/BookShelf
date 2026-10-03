"""BookShelf backend API tests."""
import os
import time
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://shelf-log-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SEED_EMAIL = "lara@test.de"
SEED_PASS = "lara1234"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def seed_token():
    r = requests.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def seed_headers(seed_token):
    return {"Authorization": f"Bearer {seed_token}"}


@pytest.fixture(scope="session")
def test_user():
    """A fresh test user we can mutate freely."""
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"name": "Test User", "email": email, "password": "secret123"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "token": data["token"], "user_id": data["user"]["user_id"]}


@pytest.fixture(scope="session")
def test_headers(test_user):
    return {"Authorization": f"Bearer {test_user['token']}"}


# ---------- health ----------
def test_health():
    r = requests.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------- auth ----------
class TestAuth:
    def test_login_seed(self, seed_token):
        assert isinstance(seed_token, str) and len(seed_token) > 10

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, seed_headers):
        r = requests.get(f"{API}/auth/me", headers=seed_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == SEED_EMAIL
        assert "user_id" in data

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_duplicate(self, test_user):
        r = requests.post(f"{API}/auth/register", json={"name": "x", "email": test_user["email"], "password": "secret123"})
        assert r.status_code == 400

    def test_logout_invalidates_token(self):
        # register a disposable user and logout
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={"name": "LO", "email": email, "password": "secret123"})
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}"}
        # Confirm valid
        assert requests.get(f"{API}/auth/me", headers=h).status_code == 200
        # Logout
        r2 = requests.post(f"{API}/auth/logout", headers=h)
        assert r2.status_code == 200
        # Should now be invalid
        r3 = requests.get(f"{API}/auth/me", headers=h)
        assert r3.status_code == 401


# ---------- books CRUD ----------
class TestBooks:
    def test_overview_seed(self, seed_headers):
        r = requests.get(f"{API}/books/overview", headers=seed_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total" in data and "status" in data
        assert "collections" in data and "categories" in data
        assert "places" in data and "series" in data
        assert "reading" in data
        assert data["total"] >= 1

    def test_create_get_update_delete(self, test_headers):
        payload = {
            "title": "TEST_Book_" + uuid.uuid4().hex[:6],
            "authors": ["Autor A"],
            "status": "to_read",
            "page_count": 300,
            "series_name": "TestSerie",
            "series_part": 1,
            "places": ["Regal 1"],
            "categories": ["Fantasy"],
            "collections": ["Favoriten"],
            "rating": 4,
        }
        r = requests.post(f"{API}/books", json=payload, headers=test_headers)
        assert r.status_code == 200, r.text
        book = r.json()
        bid = book["id"]
        assert book["title"] == payload["title"]
        assert book["authors"] == ["Autor A"]
        assert book["series_name"] == "TestSerie"
        assert book["series_part"] == 1

        # GET
        r = requests.get(f"{API}/books/{bid}", headers=test_headers)
        assert r.status_code == 200
        assert r.json()["title"] == payload["title"]

        # PATCH -> finished auto-sets end_date/progress 100
        r = requests.patch(f"{API}/books/{bid}", json={"status": "finished"}, headers=test_headers)
        assert r.status_code == 200
        updated = r.json()
        assert updated["status"] == "finished"
        assert updated["end_date"] is not None
        assert updated["progress_percent"] == 100
        assert updated["current_page"] == 300

        # PATCH current_page recalculates percent
        requests.patch(f"{API}/books/{bid}", json={"status": "reading", "current_page": 150}, headers=test_headers)
        r = requests.get(f"{API}/books/{bid}", headers=test_headers)
        d = r.json()
        assert d["current_page"] == 150
        assert d["progress_percent"] == 50

        # DELETE
        r = requests.delete(f"{API}/books/{bid}", headers=test_headers)
        assert r.status_code == 200
        r = requests.get(f"{API}/books/{bid}", headers=test_headers)
        assert r.status_code == 404

    def test_other_user_cannot_access(self, test_headers, seed_headers):
        # Create a book as test user
        r = requests.post(f"{API}/books", json={"title": "TEST_private", "authors": ["X"], "status": "to_read"}, headers=test_headers)
        bid = r.json()["id"]
        # Access as seed user
        r2 = requests.get(f"{API}/books/{bid}", headers=seed_headers)
        assert r2.status_code == 404
        # cleanup
        requests.delete(f"{API}/books/{bid}", headers=test_headers)

    def test_list_filters(self, seed_headers):
        r = requests.get(f"{API}/books", headers=seed_headers, params={"status": "finished"})
        assert r.status_code == 200
        for b in r.json():
            assert b["status"] == "finished"

        r = requests.get(f"{API}/books", headers=seed_headers, params={"q": "a", "sort": "title"})
        assert r.status_code == 200


# ---------- taxonomy ----------
class TestTaxonomy:
    def test_add_list_delete_collection(self, test_headers):
        name = f"TEST_Coll_{uuid.uuid4().hex[:5]}"
        r = requests.post(f"{API}/taxonomy/collections", json={"name": name}, headers=test_headers)
        assert r.status_code == 200
        assert r.json()["name"] == name
        assert r.json()["count"] == 0

        r = requests.get(f"{API}/taxonomy/collections", headers=test_headers)
        names = [i["name"] for i in r.json()]
        assert name in names

        r = requests.delete(f"{API}/taxonomy/collections/{name}", headers=test_headers)
        assert r.status_code == 200

    def test_authors(self, seed_headers):
        r = requests.get(f"{API}/authors", headers=seed_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            e = data[0]
            assert "name" in e and "total" in e and "finished" in e


# ---------- stats ----------
class TestStats:
    def test_stats_default(self, seed_headers):
        r = requests.get(f"{API}/stats", headers=seed_headers)
        assert r.status_code == 200
        data = r.json()
        assert "totals" in data and "year_summary" in data
        assert len(data["per_month"]) == 12
        assert "by_format" in data
        assert "by_rating" in data
        assert "top_authors" in data

    def test_stats_year(self, seed_headers):
        r = requests.get(f"{API}/stats", headers=seed_headers, params={"year": 2026})
        assert r.status_code == 200
        assert r.json()["year"] == 2026


# ---------- search ----------
class TestSearch:
    def test_search_fallback(self, seed_headers):
        r = requests.get(f"{API}/search", headers=seed_headers, params={"q": "Sarah Sprinz", "lang": "de"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "items" in data and "source" in data
        assert data["source"] in ("google", "openlibrary")
        # Should at least return some items for a popular query (allow 0 for strict lang)
        if data["items"]:
            item = data["items"][0]
            assert "title" in item
            # cover_url can be None but key must exist
            assert "cover_url" in item

    def test_search_cache_second_call_faster_identical(self, seed_headers):
        q = f"Onyx Storm {uuid.uuid4().hex[:4]}"  # unique to avoid prior cache
        t0 = time.time()
        r1 = requests.get(f"{API}/search", headers=seed_headers, params={"q": q, "lang": "de"})
        d1 = time.time() - t0
        assert r1.status_code == 200
        body1 = r1.json()
        # Second call should be cached (if items were returned)
        t0 = time.time()
        r2 = requests.get(f"{API}/search", headers=seed_headers, params={"q": q, "lang": "de"})
        d2 = time.time() - t0
        assert r2.status_code == 200
        body2 = r2.json()
        assert body1 == body2  # identical
        if body1.get("items"):
            # cached response is almost always much faster
            assert d2 <= d1 + 0.1, f"Expected cache faster: first={d1:.3f}s second={d2:.3f}s"

    def test_search_onyx_storm_fast(self, seed_headers):
        t0 = time.time()
        r = requests.get(f"{API}/search", headers=seed_headers, params={"q": "Onyx Storm"})
        elapsed = time.time() - t0
        assert r.status_code == 200
        assert elapsed < 15, f"Search too slow: {elapsed:.2f}s"


# ---------- session longevity ----------
class TestSession:
    def test_session_expiry_is_about_one_year(self):
        """After login, user_sessions.expires_at should be ~365 days ahead."""
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if not mongo_url or not db_name:
            pytest.skip("MONGO_URL/DB_NAME not available in test env")
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={"name": "SessionTest", "email": email, "password": "secret123"})
        assert r.status_code == 200
        token = r.json()["token"]
        client = MongoClient(mongo_url)
        session = client[db_name].user_sessions.find_one({"session_token": token})
        assert session is not None
        exp = session["expires_at"]
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        delta = exp - datetime.now(timezone.utc)
        # Should be close to 365 days (allow +/- 2 days)
        assert timedelta(days=363) < delta < timedelta(days=366), f"expires_at delta={delta}"
        # /auth/me should work
        r2 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200
        # Logout invalidates
        requests.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {token}"})
        r3 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r3.status_code == 401
