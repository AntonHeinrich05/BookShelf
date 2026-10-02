from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Status = Literal["wishlist", "to_read", "reading", "finished", "abandoned"]
BookFormat = Literal["paperback", "hardcover", "ebook", "audiobook"]
Ownership = Literal["owned", "not_owned", "borrowed"]
ProgressType = Literal["pages", "percent"]
TaxonomyKind = Literal["collections", "categories", "places", "series"]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Auth ----------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    auth_provider: str = "email"
    created_at: Optional[str] = None


class RegisterInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class SessionInput(BaseModel):
    session_id: str


class AuthResponse(BaseModel):
    user: User
    token: str


# ---------- Books ----------
class BookBase(BaseModel):
    title: str = Field(min_length=1)
    authors: List[str] = []
    cover_url: Optional[str] = None
    isbn: Optional[str] = None
    publisher: Optional[str] = None
    published_year: Optional[int] = None
    description: Optional[str] = None
    google_id: Optional[str] = None
    page_count: Optional[int] = None
    status: Status = "to_read"
    marked: bool = False
    format: Optional[BookFormat] = None
    ownership: Ownership = "not_owned"
    progress_type: ProgressType = "pages"
    current_page: int = 0
    progress_percent: int = 0
    rating: int = Field(0, ge=0, le=5)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    series_name: Optional[str] = None
    series_part: Optional[float] = None
    places: List[str] = []
    categories: List[str] = []
    collections: List[str] = []
    notes: Optional[str] = None


class BookCreate(BookBase):
    pass


class BookUpdate(BaseModel):
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    cover_url: Optional[str] = None
    isbn: Optional[str] = None
    publisher: Optional[str] = None
    published_year: Optional[int] = None
    description: Optional[str] = None
    google_id: Optional[str] = None
    page_count: Optional[int] = None
    status: Optional[Status] = None
    marked: Optional[bool] = None
    format: Optional[BookFormat] = None
    ownership: Optional[Ownership] = None
    progress_type: Optional[ProgressType] = None
    current_page: Optional[int] = None
    progress_percent: Optional[int] = None
    rating: Optional[int] = Field(None, ge=0, le=5)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    series_name: Optional[str] = None
    series_part: Optional[float] = None
    places: Optional[List[str]] = None
    categories: Optional[List[str]] = None
    collections: Optional[List[str]] = None
    notes: Optional[str] = None


class Book(BookBase):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    created_at: str
    updated_at: str


# ---------- Taxonomy ----------
class TaxonomyInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class TaxonomyItem(BaseModel):
    name: str
    count: int
