"""Hintergrund-Jobs mit Fortschritt (Import, Cover-Suche, Reihen-Erkennung)."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from auth_utils import get_current_user
from database import db
from models import User, now_iso

router = APIRouter(prefix="/jobs", tags=["jobs"])


async def create_job(user_id: str, kind: str, total: int = 0) -> str:
    job_id = str(uuid.uuid4())
    await db.jobs.insert_one({
        "id": job_id, "user_id": user_id, "kind": kind, "status": "running", "phase": kind, "total": total, "done": 0,
        "added": 0, "skipped": 0, "failed": [], "failed_count": 0, "covers_fixed": 0, "series_found": 0, "message": None,
        "created_at": datetime.now(timezone.utc), "updated_at": now_iso(),
    })
    return job_id


async def update_job(job_id: Optional[str], **fields):
    if not job_id:
        return
    await db.jobs.update_one({"id": job_id}, {"$set": {**fields, "updated_at": now_iso()}})


async def finish_job(job_id: Optional[str], error: Optional[str] = None):
    await update_job(job_id, status="error" if error else "done", phase="done", message=error)


@router.get("/{job_id}")
async def get_job(job_id: str, user: User = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id, "user_id": user.user_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job nicht gefunden")
    job["failed"] = (job.get("failed") or [])[:50]
    if isinstance(job.get("created_at"), datetime):
        job["created_at"] = job["created_at"].isoformat()
    return job
