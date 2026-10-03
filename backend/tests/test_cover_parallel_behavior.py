"""Unit regression for parallel first-available cover source behavior."""

import asyncio
import time
from pathlib import Path
import sys



sys.path.append(str(Path(__file__).resolve().parents[1]))
import cover_store  # noqa: E402


def test_first_available_image_prefers_fast_valid_source(monkeypatch):
    # Module: parallel source race; fast valid candidate should win without waiting for slow/broken
    calls = []

    async def fake_download(_client, url):
        calls.append(url)
        if "slow-broken" in url:
            await asyncio.sleep(0.9)
            return None
        if "fast-dnb" in url:
            await asyncio.sleep(0.08)
            return b"jpeg-bytes"
        await asyncio.sleep(0.2)
        return None

    monkeypatch.setattr(cover_store, "download_image", fake_download)

    urls = [
        "https://portal.dnb.de/slow-broken",
        "https://d-nb.info/fast-dnb",
        "https://covers.openlibrary.org/other",
    ]

    start = time.perf_counter()
    result = asyncio.run(cover_store.first_available_image(None, urls))
    elapsed = time.perf_counter() - start

    assert result == b"jpeg-bytes"
    assert elapsed < 0.5
    assert any("fast-dnb" in u for u in calls)
