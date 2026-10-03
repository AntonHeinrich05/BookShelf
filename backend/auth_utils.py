import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import HTTPException, Request, Response

from database import db
from models import User

SESSION_DAYS = 365
COOKIE_NAME = "session_token"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


async def create_session(user_id: str, token: str | None = None) -> str:
    token = token or f"sess_{uuid.uuid4().hex}{uuid.uuid4().hex}"
    await db.user_sessions.insert_one(
        {
            "user_id": user_id,
            "session_token": token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS),
            "created_at": datetime.now(timezone.utc),
        }
    )
    return token


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=SESSION_DAYS * 24 * 3600,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/", samesite="none", secure=True)


def extract_token(request: Request) -> str | None:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return None


async def get_current_user(request: Request) -> User:
    token = extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Nicht angemeldet")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Sitzung ungültig")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sitzung abgelaufen")
    # sliding expiry: keep active users logged in indefinitely
    if expires_at - datetime.now(timezone.utc) < timedelta(days=SESSION_DAYS - 7):
        await db.user_sessions.update_one(
            {"session_token": token}, {"$set": {"expires_at": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)}}
        )
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Benutzer nicht gefunden")
    return User(**user_doc)
