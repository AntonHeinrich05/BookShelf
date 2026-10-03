import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from auth_utils import (
    clear_session_cookie,
    create_session,
    extract_token,
    get_current_user,
    hash_password,
    set_session_cookie,
    verify_password,
)
from database import db
from models import AuthResponse, GoogleLoginInput, LoginInput, RegisterInput, User, now_iso

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/config")
async def auth_config():
    return {"google_client_id": os.environ.get("GOOGLE_CLIENT_ID", "").strip() or None}


def new_user_id() -> str:
    return f"user_{uuid.uuid4().hex[:12]}"


async def respond_with_session(response: Response, user_doc: dict, token: str | None = None) -> AuthResponse:
    token = await create_session(user_doc["user_id"], token)
    set_session_cookie(response, token)
    return AuthResponse(user=User(**user_doc), token=token)


@router.post("/register", response_model=AuthResponse)
async def register(data: RegisterInput, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-Mail ist bereits registriert")
    user_doc = {
        "user_id": new_user_id(),
        "email": email,
        "name": data.name.strip(),
        "picture": None,
        "auth_provider": "email",
        "password_hash": hash_password(data.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    user_doc.pop("_id", None)
    return await respond_with_session(response, user_doc)


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginInput, response: Response):
    user_doc = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user_doc or not user_doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="E-Mail oder Passwort falsch")
    if not verify_password(data.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="E-Mail oder Passwort falsch")
    return await respond_with_session(response, user_doc)


@router.post("/google", response_model=AuthResponse)
async def google_login(data: GoogleLoginInput, response: Response):
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(status_code=503, detail="Google-Login ist noch nicht eingerichtet (GOOGLE_CLIENT_ID fehlt)")
    try:
        info = id_token.verify_oauth2_token(data.credential, google_requests.Request(), client_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Google-Anmeldung fehlgeschlagen")
    if info.get("iss") not in {"accounts.google.com", "https://accounts.google.com"} or not info.get("sub") or not info.get("email"):
        raise HTTPException(status_code=401, detail="Google-Anmeldung fehlgeschlagen")
    email = info["email"].lower()
    user_doc = await db.users.find_one({"$or": [{"google_sub": info["sub"]}, {"email": email}]}, {"_id": 0})
    if user_doc:
        updates = {"google_sub": info["sub"], "picture": info.get("picture") or user_doc.get("picture")}
        if not user_doc.get("name"):
            updates["name"] = info.get("name") or email
        await db.users.update_one({"user_id": user_doc["user_id"]}, {"$set": updates})
        user_doc.update(updates)
    else:
        user_doc = {
            "user_id": new_user_id(),
            "email": email,
            "name": info.get("name") or email,
            "picture": info.get("picture"),
            "auth_provider": "google",
            "google_sub": info["sub"],
            "created_at": now_iso(),
        }
        await db.users.insert_one(user_doc)
        user_doc.pop("_id", None)
    return await respond_with_session(response, user_doc)


@router.get("/me", response_model=User)
async def me(user: User = Depends(get_current_user)):
    return user


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = extract_token(request)
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    clear_session_cookie(response)
    return {"ok": True}
