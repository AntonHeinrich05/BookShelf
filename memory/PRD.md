# BookShelf – PRD

## Original Problem Statement
Laras Lese-Tracker (React-PWA + FastAPI + MongoDB, Hosting Render). Vorbild: iOS „Bookshelf“-App. Iteration 3 (Okt 2026) – Wünsche des Users:
Tastatur-Bug/Vollbild (Header überlappt Uhrzeit, schwarzer Bereich nach Tastatur), nur Formate Buch/eBook/Hörbuch (Reihenfolge überall), „Kategorien“ → „Genres“ mit automatischer Erkennung + keine Duplikate + bearbeitbar/löschbar, Wunschliste getrennt von Bibliothek, Filter (Besitz/Gelesen) mit Zählern, Fertig-Sheet mit Seiten-Kreis/Datum/Bewertung, Lese-Timer beim Tippen aufs Buch (echte Lesezeit, sonst Schätzung/Hörbuchlänge; Statistik in Stunden), Bookshelf-ZIP-Import, Kindle/Tolino-Import, fehlertolerante Suche, Statistik-Tooltip („value“ weg), Kalenderfarben, Google-Login ohne Emergent, Reihe automatisch übernehmen, iPhone-Controls (Swipe zum Löschen).

## User Choices
- Bestehenden Code (GitHub `reihe-sammlung-fix`) weiterentwickeln (CRA/craco Web-App, React 18.3, date-fns 3.6 – für Render-Static-Build)
- Google-Login: eigene OAuth-Client-ID (User legt sie an; Anleitung im README) – kein Emergent-Auth mehr
- Kindle/Tolino: Datei-Import (Kindle-Bookmarklet → JSON, CSV), kein Account-Scraping
- Alles in Runde 1 priorisiert

## Architecture
- Backend FastAPI `/app/backend`: `server.py` (Startup-Migration Formate), `models.py`, `genres.py` (Auto-Genre), `routers/{auth,books,sessions,imports,search,taxonomy,stats}.py`
- Frontend CRA `/app/frontend/src`: `context/{Auth,Theme,ReadingTimer}Context`, `hooks/{useBooks,useKeyboardViewport}`, `components/{layout(AppShell,TabBar,TimerBar,PageHeader), ios(Group,Form,SwipeRow), books(BookForm,FinishSheet,ProgressRing,BookDetailSections…), library, calendar, auth/GoogleSignIn}`, `pages/{Library,BookList,BookDetail,ReadingTimer,Search,Stats,Calendar,Settings,Import,Login}`
- Preview-Umgebung: supervisor startet `yarn expo start` → `scripts/dev-server.sh` startet craco auf Port 3000 (Web-App, kein Expo)
- Mongo: users, user_sessions, books, taxonomy, reading_sessions, search_cache

## Implemented
- 2026-06 Iteration 1+2: Basis-App (siehe Git-Historie)
- 2026-10 Iteration 3:
  - Vollbild/Tastatur: `#root` als einziger Scroll-Container, `interactive-widget=resizes-content`, `--kb` aus visualViewport, Sheets `h-sheet`, vaul `repositionInputs={false}`, Header `pt-status` (Safe-Area)
  - Formate: book/ebook/audiobook (Migration paperback/hardcover→book), Hörbuch-Länge (Minuten)
  - Genres: Auto-Erkennung (Google-Kategorien/Titel/Beschreibung → deutsches Genre, Default „Roman“), case-insensitive Kanonisierung, Rename-Endpoint, Swipe-Row (Umbenennen/Löschen) für Reihen/Genres/Sammlungen/Orte
  - Bibliothek ohne Wunschliste (scope), Gruppen Wunschliste/Gelesen, Filter-Chips Besitz + Gelesen/Ungelesen mit Zählern
  - FinishSheet (Kreis-Dial, Start/Ende, Sterne, Leseprotokoll löschen), ProgressCard mit Ring + Restzeit
  - Lese-Timer: globaler Context (localStorage), Vollbild-Seite mit Blur-Cover, Play/Pause, Beenden → Seite eintragen → Session; TimerBar über TabBar; Lesezeit-Gruppe im Detail; Stats in Stunden (getrackt + geschätzt, persönliches Tempo)
  - Suche: Datamuse-Korrektur + Wort-weglassen-Fallback + rapidfuzz-Filter; lokale Listensuche fuzzy; „Meintest du …“
  - Statistik: Tooltip nur Zahl, Lesezeit-Kacheln, Metrik Stunden, Genres-Verteilung; Kalender: eindeutige Farben pro Buch im Monat
  - Import: Bookshelf-ZIP (Books/Reading_History/Collections → Status, Daten, Bewertung, Reihen, Orte, Sammlungen, Genres, Cover via Google-ID), Goodreads/Generic CSV, Kindle-JSON (Bookmarklet), Dedup; CSV-Export
  - Google-Login via Google Identity Services (`/auth/google`, `/auth/config`), Emergent-Auth entfernt
  - Reihe wird automatisch aus Titel übernommen, wenn bekannt oder Teil-Nr. gesetzt
  - Testing: iteration_3 – Backend 20/20, Frontend alle Flows OK

## Backlog
- P1: GOOGLE_CLIENT_ID vom User eintragen & Login live testen; Tolino-Webreader-Export (Bookmarklet analog Kindle) prüfen
- P1: Mehrere Lesedurchgänge („Lesen #2“) als eigene Protokolle; Swipe-Löschen auch für Bücher in Listen
- P2: Jahres-Leseziel, Lesestreak, Hörbuch-Timer mit Kapiteln, Service Worker Offline, Apple-Login
- P2: GOOGLE_BOOKS_API_KEY setzen (Quota)
