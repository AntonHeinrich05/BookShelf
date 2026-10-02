import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

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
from models import AuthResponse, LoginInput, RegisterInput, SessionInput, User, now_iso

router = APIRouter(prefix="/auth", tags=["auth"])

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


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


@router.post("/session", response_model=AuthResponse)
async def google_session(data: SessionInput, response: Response):
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": data.session_id})
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Google-Anmeldung fehlgeschlagen")
    payload = res.json()
    email = payload["email"].lower()
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if user_doc:
        updates = {"picture": payload.get("picture") or user_doc.get("picture")}
        if not user_doc.get("name"):
            updates["name"] = payload.get("name") or email
        await db.users.update_one({"user_id": user_doc["user_id"]}, {"$set": updates})
        user_doc.update(updates)
    else:
        user_doc = {
            "user_id": new_user_id(),
            "email": email,
            "name": payload.get("name") or email,
            "picture": payload.get("picture"),
            "auth_provider": "google",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user_doc)
        user_doc.pop("_id", None)
    return await respond_with_session(response, user_doc, payload.get("session_token"))


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
