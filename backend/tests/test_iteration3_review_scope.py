"""Focused regression tests for standalone shelf semantics and cover response behavior."""

import os
import uuid
from datetime import date

import pytest
import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE_URL.rstrip('/')}/api"
FIXTURE = "/app/backend/tests/fixtures/dnb-cover.jpg"


def _login_known_account() -> dict:
    # Module: auth login for dedicated preview QA account
    email = "update-test@bookshelf.example"
    password = "BookShelf-Update-2026!"
    res = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert res.status_code == 200, res.text
    token = res.json().get("token")
    assert isinstance(token, str) and len(token) > 10
    return {"Authorization": f"Bearer {token}"}


def _create_book(headers: dict, **overrides) -> dict:
    payload = {
        "title": f"TEST_I3_{uuid.uuid4().hex[:8]}",
        "authors": ["QA Bot"],
        "status": "to_read",
        "ownership": "owned",
        "progress_type": "pages",
        "page_count": 180,
    }
    payload.update(overrides)
    res = requests.post(f"{API}/books", headers=headers, json=payload, timeout=30)
    assert res.status_code == 200, res.text
    return res.json()


@pytest.fixture()
def seeded_standalone_books():
    # Module: create realistic standalone/series mix and clean up afterwards
    headers = _login_known_account()
    marker = f"TEST_I3_SCOPE_{uuid.uuid4().hex[:6]}"
    today = date.today().isoformat()
    created = []

    b1 = _create_book(headers, title=f"{marker}_finished_no_series", status="finished", end_date=today)
    b2 = _create_book(headers, title=f"{marker}_to_read_no_series", status="to_read")
    b3 = _create_book(headers, title=f"{marker}_finished_real_series", status="finished", series_name="QA Saga", series_part=1, end_date=today)
    b4 = _create_book(headers, title=f"{marker}_finished_lonely", status="finished", series_name="Lonely Books", end_date=today)
    b5 = _create_book(headers, title=f"{marker}_Band 2 ohne Reihe", status="finished", end_date=today)
    created.extend([b1["id"], b2["id"], b3["id"], b4["id"], b5["id"]])

    yield {
        "headers": headers,
        "marker": marker,
        "ids": {"no_series_finished": b1["id"], "to_read_no_series": b2["id"], "real_series_finished": b3["id"], "lonely_finished": b4["id"], "title_band_finished": b5["id"]},
    }

    for book_id in created:
        requests.delete(f"{API}/books/{book_id}", headers=headers, timeout=20)


def test_standalone_overview_and_none_series_alignment(seeded_standalone_books):
    # Module: /books/overview series_none agrees with /books?series=__none__
    headers = seeded_standalone_books["headers"]
    marker = seeded_standalone_books["marker"]

    ov = requests.get(f"{API}/books/overview", headers=headers, timeout=20)
    assert ov.status_code == 200, ov.text
    series_none = ov.json().get("series_none")
    assert isinstance(series_none, int)

    listed = requests.get(
        f"{API}/books",
        headers=headers,
        params={"series": "__none__", "q": marker, "scope": "all", "limit": 200},
        timeout=30,
    )
    assert listed.status_code == 200, listed.text
    payload = listed.json()
    items = payload["items"] if isinstance(payload, dict) else payload
    ids = {b["id"] for b in items}

    assert seeded_standalone_books["ids"]["no_series_finished"] in ids
    assert seeded_standalone_books["ids"]["lonely_finished"] in ids
    assert seeded_standalone_books["ids"]["to_read_no_series"] not in ids
    assert seeded_standalone_books["ids"]["real_series_finished"] not in ids
    assert seeded_standalone_books["ids"]["title_band_finished"] not in ids
    assert series_none >= 2


def test_standalone_filters_limit_read_and_ownership(seeded_standalone_books):
    # Module: standalone shelf respects read and ownership filters
    headers = seeded_standalone_books["headers"]
    marker = seeded_standalone_books["marker"]

    res = requests.get(
        f"{API}/books",
        headers=headers,
        params={"series": "__none__", "q": marker, "read": "read", "ownership": "owned", "limit": 50, "scope": "all"},
        timeout=30,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    items = data["items"] if isinstance(data, dict) else data
    assert len(items) >= 2
    assert all(b["status"] == "finished" for b in items)
    assert all(b["ownership"] == "owned" for b in items)


def test_assigning_real_series_removes_from_none_group(seeded_standalone_books):
    # Module: updating no-series finished book to real series removes it from __none__
    headers = seeded_standalone_books["headers"]
    target = seeded_standalone_books["ids"]["no_series_finished"]

    patch = requests.patch(
        f"{API}/books/{target}",
        headers=headers,
        json={"series_name": "Assigned QA Series", "series_part": 1},
        timeout=20,
    )
    assert patch.status_code == 200, patch.text
    assert patch.json().get("series_name") == "Assigned QA Series"

    listed = requests.get(
        f"{API}/books",
        headers=headers,
        params={"series": "__none__", "scope": "all", "limit": 200},
        timeout=30,
    )
    assert listed.status_code == 200, listed.text
    payload = listed.json()
    items = payload["items"] if isinstance(payload, dict) else payload
    ids = {b["id"] for b in items}
    assert target not in ids


def test_saved_cover_returns_etag_and_not_modified_with_if_none_match():
    # Module: /covers durable response behavior for already stored image
    headers = _login_known_account()
    book = _create_book(headers, title=f"TEST_I3_COVER_{uuid.uuid4().hex[:6]}")
    book_id = book["id"]
    try:
        with open(FIXTURE, "rb") as fh:
            up = requests.post(f"{API}/books/{book_id}/cover", headers=headers, files={"file": ("dnb-cover.jpg", fh, "image/jpeg")}, timeout=40)
        assert up.status_code == 200, up.text
        cover_url = up.json()["cover_url"]

        r1 = requests.get(f"{BASE_URL.rstrip('/')}{cover_url}", headers=headers, timeout=30)
        assert r1.status_code == 200, r1.text
        assert r1.headers.get("etag")
        assert r1.headers.get("x-cover-revision")

        r2 = requests.get(
            f"{BASE_URL.rstrip('/')}{cover_url}",
            headers={**headers, "If-None-Match": r1.headers["etag"]},
            timeout=30,
        )
        assert r2.status_code == 304
    finally:
        requests.delete(f"{API}/books/{book_id}", headers=headers, timeout=20)
