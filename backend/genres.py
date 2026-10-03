"""Automatische Genre-Erkennung aus Google-Books-Kategorien, Titel und Beschreibung."""
import re

DEFAULT_GENRE = "Roman"

# Google-Books-Kategorien (en) → deutsches Genre
CATEGORY_MAP = [
    (r"dark romance", "Dark Romance"),
    (r"new adult", "New Adult"),
    (r"young adult|juvenile fiction|teen", "Young Adult"),
    (r"romance|love stories|liebe", "Romance"),
    (r"fantasy|magic|dragons|witches", "Fantasy"),
    (r"science fiction|sci-fi|dystopia", "Science Fiction"),
    (r"thriller|suspense", "Thriller"),
    (r"mystery|detective|crime|krimi", "Krimi"),
    (r"horror", "Horror"),
    (r"historical|history", "Historisch"),
    (r"biography|autobiography|memoir", "Biografie"),
    (r"self-help|psychology|business|health|cooking|travel|religion|philosophy|science|nature|art|sport", "Sachbuch"),
    (r"poetry|lyrik", "Lyrik"),
    (r"comics|graphic novel|manga", "Comic & Manga"),
    (r"humor|comedy", "Humor"),
    (r"classic", "Klassiker"),
    (r"children|kinder|picture book", "Kinderbuch"),
    (r"fiction|literary|novel", "Roman"),
]

# Schlagwörter in Titel/Beschreibung (de/en)
KEYWORDS = [
    (r"dark romance", "Dark Romance"),
    (r"\bnew adult\b", "New Adult"),
    (r"young adult|jugendbuch", "Young Adult"),
    (r"liebesroman|romance|verliebt|herz|liebe|kiss|küss|love", "Romance"),
    (r"drache|magie|zauber|elfen|fae|hexe|fantasy|königreich|prophezeiung", "Fantasy"),
    (r"raumschiff|zukunft|dystopi|science fiction|roboter|ki\b", "Science Fiction"),
    (r"thriller|psychothriller|entführ|serienmörder", "Thriller"),
    (r"krimi|kommissar|mord|detektiv|ermittl", "Krimi"),
    (r"horror|grauen", "Horror"),
    (r"historisch|mittelalter|jahrhundert|weltkrieg", "Historisch"),
    (r"biografie|memoir|mein leben", "Biografie"),
    (r"ratgeber|sachbuch|anleitung|how to|guide", "Sachbuch"),
]


def _match(rules, text: str):
    text = text.lower()
    for pattern, genre in rules:
        if re.search(pattern, text):
            return genre
    return None


def detect_genre(google_categories, title: str = "", description: str = "") -> str:
    # Regeln nach Priorität über ALLE Kategorien prüfen (spezifisch vor generisch, z. B. Romance vor "Fiction")
    cats = " | ".join(c for c in (google_categories or []) if c).lower()
    if cats:
        for pattern, genre in CATEGORY_MAP:
            if re.search(pattern, cats):
                return genre
    genre = _match(KEYWORDS, f"{title} {description or ''}")
    return genre or DEFAULT_GENRE


def canonical(name: str, existing: list[str]) -> str:
    """Gleiche Schreibweise wie ein vorhandenes Genre → vorhandenen Namen übernehmen (keine Duplikate)."""
    key = re.sub(r"\s+", " ", name.strip()).lower()
    for ex in existing:
        if re.sub(r"\s+", " ", ex.strip()).lower() == key:
            return ex
    return re.sub(r"\s+", " ", name.strip())
