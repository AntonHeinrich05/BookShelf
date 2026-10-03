# BookShelf – PRD

## Original Problem Statement
Laras Lese-Tracker: Bücher eintragen & Überblick behalten (Vorbild: iOS „Bookshelf“-App-Screenshots). Serien mit Teil-Nr. überall sichtbar, Büchersuche mit Covern, Formate (Taschenbuch/Hörbuch/eBook/Hardcover), Autoren-Übersicht (wie viele gelesen → welche), Orte, Seiten/Fortschritt, Datum, Bewertung 1–5, Kalender mit Covern (Start/Ende/Lesezeitraum dezent & clean), Login Google/Apple, Hosting via Render + MongoDB, PWA für iPhone, responsive Handy/Tablet, stylisch dezent & clean.

## User Choices
- Login: E-Mail/Passwort (Sessions) + Emergent-managed Google Auth (Apple später, braucht Developer-Account)
- Suche: Google Books API (ohne Key) – Fallback Open Library bei Rate-Limit
- Design: Dark default, Hell/Dunkel umschaltbar, iOS-Look wie Screenshots
- Umfang: alles im ersten Wurf, Code übersichtlich für Updates; mehrere Nutzer; GitHub + Render

## Architecture
- Backend FastAPI (`/app/backend`): `server.py`, `database.py`, `models.py`, `auth_utils.py`, `routers/{auth,books,search,taxonomy,stats}.py`
- Frontend React 19 + Tailwind + shadcn + react-query (`/app/frontend/src`): `context/`, `hooks/useBooks.js`, `lib/`, `components/{layout,ios,books,calendar,library}`, `pages/`
- MongoDB collections: users, user_sessions, books, taxonomy
- PWA: manifest.json, apple-touch-icon, standalone meta; `render.yaml` Blueprint (API + Static Site)

## Implemented (2026-06)
- Iteration 2: Sessions 365 Tage + sliding renewal (dauerhaft angemeldet), Passwort-Auge im Login, Labels „eBook“/„Im Besitz“, Datum→Status-Automatik im Formular, Zahlenfelder ohne führende 0, SeriesPicker (aus Titel abgeleitet + vorhandene Reihen durchsuchbar), Tag-Picker zeigen vorhandene Werte, Kalender neu (große Cover, Farbe pro Buch, Titel einmal, Haken am Ende, keine Legende), Suche: Mongo-Cache + Google/OpenLibrary parallel, Frontend-Cache persistiert (react-query persist), Render Keep-Alive (`KEEP_ALIVE_URL`) + README-Anleitung für Web Services / Static Site
- Auth: Register/Login/Logout (bcrypt + Session-Token Cookie & Bearer), Google via Emergent Auth
- Bibliothek: Status-Gruppen, Markiert, Autoren, Serien, Sammlungen, Kategorien, Orte (anlegbar), Formate, Besitz, „Aktuell am Lesen“ mit Fortschritt
- Buch hinzufügen/bearbeiten (Bottom-Sheet, iOS-Gruppen): Details, Status, Format, Fortschrittstyp Seiten/%, Bewertung, Start/Ende, Besitz, Serie + Teil, Tags, Notizen
- Suche „Entdecken“ (Google Books → Open Library Fallback), Sprachfilter, Mood-Chips, „in Bibliothek“-Marker, manuell anlegen
- Detailseite: Status-Chips, Sterne, Fortschritt (Slider), Lesedaten, Details, Tags, Beschreibung, Löschen
- Listen: Filter per URL, Suche, Sortierung, Grid/Liste, „Teil X“-Badge überall
- Autoren-Seite, Lesekalender (Cover=Start, Haken=Ende, Balken=Zeitraum, laufend markiert), Statistiken (Jahr/Monat, Formate, Bewertungen, Top-Autoren), Einstellungen (Theme, Install-Hinweis, Logout)
- Testing: iteration_1 – Backend 100 %, Frontend 100 %

## Backlog
- P1: Apple-Login (Sign in with Apple, braucht Apple Developer Account); Sammlungen/Orte umbenennen & löschen in UI; Barcode/ISBN-Scanner
- P2: Lese-Sessions (Seiten pro Tag) für genauere Kalender-Statistik; Export (CSV); Jahres-Leseziel; Service Worker (Offline-Cache)
- P2: GOOGLE_BOOKS_API_KEY optional setzen (Env), um Google-Quota zu erhöhen

## Deployment Notes
- Render: `render.yaml` → Services `bookshelf-api` (MONGO_URL, DB_NAME, CORS_ORIGINS) und `bookshelf-web` (REACT_APP_BACKEND_URL). README enthält Schritt-für-Schritt-Anleitung.
