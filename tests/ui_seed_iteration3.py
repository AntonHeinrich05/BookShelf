"""Seed preview QA account with enough books for mobile scroll and calendar/author cover checks."""

import json
import os
import uuid
from datetime import date

import requests


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL must be set")
API = f"{BASE_URL.rstrip('/')}/api"
FIXTURE = "/app/backend/tests/fixtures/dnb-cover.jpg"


def main():
    login = requests.post(
        f"{API}/auth/login",
        json={"email": "update-test@bookshelf.example", "password": "BookShelf-Update-2026!"},
        timeout=20,
    )
    login.raise_for_status()
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    marker = f"TEST_UI3_{uuid.uuid4().hex[:6]}"
    today = date.today().isoformat()
    ids = []

    # Finished no-series entry with reading date in current month
    primary = requests.post(
        f"{API}/books",
        headers=headers,
        json={
            "title": f"{marker}_calendar_fixture",
            "authors": ["UI QA Author"],
            "status": "finished",
            "ownership": "owned",
            "progress_type": "pages",
            "page_count": 250,
            "start_date": today,
            "end_date": today,
        },
        timeout=30,
    )
    primary.raise_for_status()
    p = primary.json()
    ids.append(p["id"])

    with open(FIXTURE, "rb") as fh:
        up = requests.post(
            f"{API}/books/{p['id']}/cover",
            headers=headers,
            files={"file": ("dnb-cover.jpg", fh, "image/jpeg")},
            timeout=40,
        )
    up.raise_for_status()

    # Additional books for long scroll and mixed states/series
    for i in range(28):
        payload = {
            "title": f"{marker}_book_{i}",
            "authors": ["UI QA Author" if i < 10 else f"Author {i%5}"],
            "status": "finished" if i % 3 != 0 else "reading",
            "ownership": "owned" if i % 2 == 0 else "borrowed",
            "progress_type": "pages",
            "page_count": 120 + i,
            "start_date": today if i % 3 != 0 else today,
            "end_date": today if i % 3 != 0 else None,
            "series_name": None if i % 4 else "Lonely Books",
        }
        r = requests.post(f"{API}/books", headers=headers, json=payload, timeout=30)
        r.raise_for_status()
        ids.append(r.json()["id"])

    os.makedirs("/app/test_reports", exist_ok=True)
    with open("/app/test_reports/iteration3_seed.json", "w", encoding="utf-8") as fh:
        json.dump({"marker": marker, "created_ids": ids, "count": len(ids)}, fh)

    print(json.dumps({"marker": marker, "count": len(ids)}))


if __name__ == "__main__":
    main()
