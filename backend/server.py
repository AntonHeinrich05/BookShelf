import logging
import os

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from database import client
from routers import auth, books, search, stats, taxonomy

import asyncio
import httpx
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

app = FastAPI(title="BookShelf API")

api_router = APIRouter(prefix="/api")


async def keep_alive():
    url = os.environ.get("KEEP_ALIVE_URL", "").rstrip("/")
    if not url:
        return

    START_HOUR = 21
    END_HOUR = 23

    async with httpx.AsyncClient(timeout=20) as http:
        while True:
            current_hour = datetime.now().hour

            if START_HOUR <= current_hour < END_HOUR:
                try:
                    await http.get(f"{url}/api/health")
                except Exception:
                    pass

            await asyncio.sleep(600)



@api_router.get("/")
async def root():
    return {"app": "BookShelf", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


api_router.include_router(auth.router)
api_router.include_router(books.router)
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

@app.on_event("startup")
async def startup():
    asyncio.create_task(keep_alive())


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
