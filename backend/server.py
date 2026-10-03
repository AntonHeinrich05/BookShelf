import asyncio
import logging
import os

import httpx
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from database import client, db
from jobs import router as jobs_router
from routers import auth, books, covers, enrich, imports, search, sessions, stats, taxonomy

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("bookshelf")
logging.getLogger("httpx").setLevel(logging.WARNING)  # Upstream query strings may contain an optional API key.

app = FastAPI(title="BookShelf API")


async def migrate_formats():
    # Hardcover/Taschenbuch → Buch (nur noch Buch, eBook, Hörbuch)
    await db.books.update_many({"format": {"$in": ["paperback", "hardcover", None]}}, {"$set": {"format": "book"}})
    await db.books.update_many({"reading_seconds": {"$exists": False}}, {"$set": {"reading_seconds": 0, "read_count": 0}})


async def keep_alive():
    # Pings own public URL every 10 min so free Render instances never spin down.
    url = os.environ.get("KEEP_ALIVE_URL", "").rstrip("/")
    if not url:
        return
    async with httpx.AsyncClient(timeout=20) as http:
        while True:
            await asyncio.sleep(600)
            try:
                await http.get(f"{url}/api/health")
            except Exception as exc:
                logger.warning("keep-alive ping failed: %s", exc)


@app.on_event("startup")
async def on_startup():
    await db.search_cache.create_index("created_at", expireAfterSeconds=7 * 24 * 3600)
    await db.books.create_index([("user_id", 1), ("status", 1)])
    await db.books.create_index([("user_id", 1), ("created_at", -1), ("id", 1)])
    await db.covers.create_index([("user_id", 1), ("book_id", 1), ("revision", 1)], unique=True)
    await db.cover_previews.create_index("url_hash", unique=True)
    await db.cover_previews.create_index("created_at", expireAfterSeconds=24 * 3600)
    await db.auth_attempts.create_index("expires_at", expireAfterSeconds=0)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.user_sessions.create_index("session_token")
    await db.reading_sessions.create_index([("user_id", 1), ("book_id", 1)])
    await db.reading_sessions.create_index([("user_id", 1), ("id", 1)], unique=True)
    await db.jobs.create_index("created_at", expireAfterSeconds=3 * 24 * 3600)
    await db.jobs.create_index("id")
    await db.jobs.update_many({"status": "running"}, {"$set": {"status": "error", "message": "Durch einen Serverneustart unterbrochen. Bitte erneut starten; vorhandene Bücher bleiben erhalten."}})
    await migrate_formats()
    asyncio.create_task(keep_alive())

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"app": "BookShelf", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


api_router.include_router(auth.router)
api_router.include_router(books.router)
api_router.include_router(covers.router)
api_router.include_router(sessions.router)
api_router.include_router(imports.router)
api_router.include_router(search.router)
api_router.include_router(taxonomy.router)
api_router.include_router(stats.router)
api_router.include_router(enrich.router)
api_router.include_router(jobs_router)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o.strip() for o in os.environ["CORS_ORIGINS"].split(",") if o.strip() != "*"] + ([os.environ["APP_ORIGIN"]] if os.environ.get("APP_ORIGIN") else []),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Cover-Revision", "ETag", "Retry-After"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
