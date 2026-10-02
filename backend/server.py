import logging
import os

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from database import client
from routers import auth, books, search, stats, taxonomy

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

app = FastAPI(title="BookShelf API")

api_router = APIRouter(prefix="/api")


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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
