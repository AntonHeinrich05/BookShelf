# BookShelf

Lese-Tracker als Fullstack-Webapp (React + FastAPI + MongoDB), installierbar als PWA auf iPhone/iPad/Android.

## Features
- Bibliothek mit Lesestatus (Wunschliste, Zu Lesen, Lesen, Fertiggestellt, Abgebrochen, Markiert)
- Büchersuche mit Cover über Google Books, manuelle Einträge möglich
- Format (Taschenbuch, Hardcover, eBuch, Hörbuch), Besitz (Besessen, Ausgeliehen, Nicht im Besitz)
- Serien mit Teil-Nummer („Teil 1“ überall sichtbar), Sammlungen, Kategorien, Orte
- Autoren-Übersicht (wie viele Bücher gelesen → Detailliste)
- Seiten-/Prozent-Fortschritt, Start-/Enddatum, Bewertung 1–5, Notizen
- Lesekalender mit Covern: Start, Ende und Lesezeitraum pro Buch
- Statistiken pro Jahr/Monat
- Login mit E-Mail/Passwort oder Google · Dark/Light Mode

## Projektstruktur
```
backend/
  server.py          FastAPI-App, bindet Router ein
  database.py        Mongo-Verbindung (MONGO_URL, DB_NAME)
  models.py          Pydantic-Modelle (User, Book, Taxonomy)
  auth_utils.py      Passwort-Hashing, Sessions, get_current_user
  routers/
    auth.py          /api/auth/* (register, login, session (Google), me, logout)
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

## Deployment auf Render (Blueprint)
1. Repo auf GitHub pushen (die `.env`-Dateien sind per `.gitignore` ausgeschlossen).
2. MongoDB Atlas Cluster anlegen (Free Tier reicht) → Connection-String kopieren.
3. Render → **New → Blueprint** → Repo wählen. `render.yaml` legt zwei Services an:
   - `bookshelf-api` (Python Web Service): `MONGO_URL` = Atlas-String, `CORS_ORIGINS` = URL des Frontends (z. B. `https://bookshelf-web.onrender.com`)
   - `bookshelf-web` (Static Site): `REACT_APP_BACKEND_URL` = URL der API (z. B. `https://bookshelf-api.onrender.com`, ohne Slash am Ende)
4. Deploy. Danach auf dem iPhone in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

Der Google-Login funktioniert auf jeder Domain automatisch (Redirect auf `window.location.origin`).
