import asyncio
import logging
import os

import httpx
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from database import client, db
from routers import auth, books, imports, search, sessions, stats, taxonomy

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("bookshelf")

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
    await db.user_sessions.create_index("session_token")
    await db.reading_sessions.create_index([("user_id", 1), ("book_id", 1)])
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
api_router.include_router(sessions.router)
api_router.include_router(imports.router)
api_router.include_router(search.router)
api_router.include_router(taxonomy.router)
api_router.include_router(stats.router)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
