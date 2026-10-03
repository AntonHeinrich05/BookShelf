# BookShelf

Lese-Tracker als Fullstack-Webapp (React + FastAPI + MongoDB), installierbar als PWA auf iPhone/iPad/Android.

## Features
- Bibliothek mit Lesestatus (Wunschliste, Zu Lesen, Lesen, Fertiggestellt, Abgebrochen, Markiert)
- Büchersuche mit Cover über Google Books, manuelle Einträge möglich
- Format (Buch, eBook, Hörbuch), Besitz (Im Besitz, Ausgeliehen, Nicht im Besitz), Genres (automatisch erkannt, bearbeitbar)
- Serien mit Teil-Nummer („Teil 1“ überall sichtbar), Sammlungen, Kategorien, Orte
- Autoren-Übersicht (wie viele Bücher gelesen → Detailliste)
- Seiten-/Prozent-Fortschritt, Start-/Enddatum, Bewertung 1–5, Notizen
- Lesekalender mit Covern: Start, Ende und Lesezeitraum pro Buch
- Statistiken pro Jahr/Monat
- Lese-Timer (echte Lesezeit), Fertig-Sheet mit Seiten-Kreis, Wunschliste getrennt von Bibliothek, Filter mit Zählern, Swipe-Aktionen
- Import (Bookshelf-ZIP, Kindle-JSON, CSV) - Login mit E-Mail/Passwort oder Google · Dark/Light Mode CSV-Export
- Login mit E-Mail/Passwort oder Google (eigene OAuth-Client-ID) · Dark/Light Mode

## Projektstruktur
```
backend/
  server.py          FastAPI-App, bindet Router ein
  database.py        Mongo-Verbindung (MONGO_URL, DB_NAME)
  models.py          Pydantic-Modelle (User, Book, Taxonomy)
  auth_utils.py      Passwort-Hashing, Sessions, get_current_user
  routers/
    auth.py          /api/auth/* (register, login, google (GIS-Credential), config, me, logout)
    sessions.py      /api/books/{id}/sessions (Lese-Timer-Sessions)
    imports.py       /api/import/{bookshelf|csv|kindle}, /api/export/csv
    books.py         /api/books (CRUD, Filter, overview)
    search.py        /api/search (Google Books Proxy)
    taxonomy.py      /api/taxonomy/{kind}, /api/authors
    stats.py         /api/stats
frontend/src/
  App.js             Routing + Provider
  context/           AuthContext, ThemeContext
  hooks/useBooks.js  React-Query Hooks für alle API-Calls
  lib/               api.js (axios), constants.js (Labels/Icons)
  components/
    layout/          AppShell, TabBar, PageHeader, Splash
    ios/             Group/Row (iOS-Listen), Form (FormRow, Select, Segmented, PillButton)
    books/           Cover, BookCard/Row/Grid, BookForm (+Sections), BookDetailSections, TagPicker
    calendar/        ReadingCalendar, CalendarWeek, calendarUtils
    library/         ReadingNow, TaxonomyGroup, AddNameDialog
  pages/             Login, Library, BookList, BookDetail, Search, Authors, Calendar, Stats, Settings
```

## Lokal starten
```
cd backend && pip install -r requirements.txt && uvicorn server:app --port 8001 --reload
cd frontend && yarn && yarn start
```
`backend/.env`: `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS` · `frontend/.env`: `REACT_APP_BACKEND_URL`

## Render: Nicht einschlafen lassen (wichtig)
Free-Web-Services auf Render schlafen nach 15 Min. ohne Traffic ein. Zwei Maßnahmen sind eingebaut/empfohlen:
1. **Backend-Selbstping**: Im Backend die Env-Variable `KEEP_ALIVE_URL` = eigene Backend-URL setzen (z. B. `https://bookshelf-api.onrender.com`). Das Backend ruft dann alle 10 Min. `/api/health` auf und bleibt wach.
2. **Externer Ping als Backup** (kostenlos): bei [UptimeRobot](https://uptimerobot.com) oder [cron-job.org](https://cron-job.org) einen Monitor auf `https://bookshelf-api.onrender.com/api/health` alle 5 Min. anlegen – weckt den Service auch nach einem Neustart sofort wieder.
3. Das **Frontend als „Static Site“** anlegen (statt Web Service): kostenlos, unbegrenzt, schläft nie. Build Command `yarn install && yarn build`, Publish Directory `build`, unter „Redirects/Rewrites“ eine Rewrite-Regel `/*` → `/index.html`. Env-Variablen wie oben.
   Hintergrund: Render Free gibt 750 Instanz-Stunden/Monat – ein dauerhaft wacher Web Service braucht ~744 h. Zwei wache Web Services würden das Limit sprengen, Static Sites zählen nicht.

Alternativ schläft ein Service im **Starter-Plan (7 $/Monat)** garantiert nie.

## Deployment auf Render (zwei Web Services, ohne Blueprint)

Vorher: Repo auf GitHub pushen, MongoDB-Atlas-Cluster anlegen (Free Tier), unter *Database → Connect → Drivers* den Connection-String kopieren (Form: `mongodb+srv://USER:PASSWORT@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`) und unter *Network Access* `0.0.0.0/0` erlauben.

### 1. Backend – „New → Web Service“
| Feld | Wert |
|---|---|
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn server:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/api/health` |

Environment Variables (Tab „Environment“):
- `MONGO_URL` = dein Atlas-Connection-String  ← **hier kommt der Atlas-String rein**
- `DB_NAME` = `bookshelf`
- `CORS_ORIGINS` = URL des Frontends, z. B. `https://bookshelf-web.onrender.com` (ohne Slash am Ende)
- `KEEP_ALIVE_URL` = eigene Backend-URL, z. B. `https://bookshelf-api.onrender.com` (verhindert Einschlafen)
- `PYTHON_VERSION` = `3.11.9`

### 2. Frontend – „New → Web Service“
| Feld | Wert |
|---|---|
| Root Directory | `frontend` |
| Runtime | Node |
| Build Command | `yarn install && yarn build` |
| Start Command | `yarn serve` |

Environment Variables:
- `REACT_APP_BACKEND_URL` = URL des Backends, z. B. `https://bookshelf-api.onrender.com` (ohne Slash am Ende)
- `DISABLE_EMERGENT_OVERLAY` = `true`
- `NODE_VERSION` = `20.18.0`

Danach bei Bedarf `CORS_ORIGINS` im Backend auf die echte Frontend-URL setzen und beide Services neu deployen.
Auf dem iPhone: Safari → Teilen → „Zum Home-Bildschirm“.

Alternativ geht `render.yaml` als Blueprint (gleiche Werte).

## Google-Login einrichten (eigene OAuth-Client-ID, ohne Drittanbieter)
1. [Google Cloud Console](https://console.cloud.google.com/) → Projekt anlegen → **APIs & Dienste → OAuth-Zustimmungsbildschirm** (extern, App-Name „BookShelf“, deine E-Mail, Scopes `openid`, `email`, `profile`).
2. **APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID → Webanwendung**.
3. Unter **Autorisierte JavaScript-Quellen** eintragen (nur Origin, ohne Pfad):
   - `https://<deine-frontend-domain>` (z. B. `https://bookshelf-web.onrender.com`)
   - `http://localhost:3000` (lokal)
4. Client-ID kopieren (endet auf `.apps.googleusercontent.com`) – **kein** Client-Secret nötig.
5. Im **Backend** (Render → Environment) `GOOGLE_CLIENT_ID=<deine Client-ID>` setzen und neu deployen. Das Frontend holt die ID automatisch über `/api/auth/config`.

## Import / Export
- **Bookshelf-App (ZIP)**, **Goodreads/Generic CSV**, **Kindle (JSON)** unter Einstellungen → Importieren. Duplikate werden erkannt (Google-ID, ASIN, ISBN, Titel+Autor) – erneuter Import ergänzt nur neue Bücher.
- **Kindle**: Es gibt keine offizielle Amazon-API. Das Export-Skript (Bookmarklet) läuft im eigenen Browser auf read.amazon.com / lesen.amazon.de mit der eigenen Anmeldung und lädt die Bibliothek als JSON – diese Datei importieren. Bücher landen als eBook; Lesefortschritt → gelesen / lesen / zu lesen.
- **Tolino**: kein Export verfügbar → CSV (Titel, Autor) importieren.
- Export: Einstellungen → „Als CSV exportieren“ (`GET /api/export/csv`).
