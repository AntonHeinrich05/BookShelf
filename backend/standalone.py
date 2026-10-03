"""Virtual read-standalone shelf. Never repurpose or overwrite a user's manual series."""
import re
from sources import SERIES_PART_RE

LONELY_BOOKS = re.compile(r"^\s*lonely\s+books\s*$", re.I)


def is_read_standalone(book: dict) -> bool:
    if book.get("status") != "finished":
        return False
    name = (book.get("series_name") or "").strip()
    if LONELY_BOOKS.fullmatch(name):
        return True  # This existing user-defined bucket explicitly collects standalone books.
    return not name and not book.get("series_part") and not SERIES_PART_RE.search(book.get("title") or "")


def read_standalone_filter() -> dict:
    return {"$and": [{"status": "finished"}, {"$or": [
        {"series_name": {"$in": [None, re.compile(r"^\s*$")]}, "series_part": {"$in": [None, 0]}, "title": {"$not": SERIES_PART_RE}},
        {"series_name": LONELY_BOOKS},
    ]}]}