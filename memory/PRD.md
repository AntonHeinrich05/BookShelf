# BookShelf – PRD

## Original Problem Statement
Laras Lese-Tracker (React-PWA + FastAPI + MongoDB, Hosting Render, **Web-App – kein Expo**). Vorbild: iOS „Bookshelf“-App.
Iteration 4 (Juni 2026) – Wünsche des Users (alles in einem Durchgang):
- Kalender: Titel weglassen (Cover reicht), Rand oben so schmal wie möglich, unten keine „gezwungene Kante“
- Statistik: statt Jahr → Letzter Monat / 3 Monate / Letztes Jahr / Gesamt; Bewertungen anklickbar → Bücher je Bewertung; muss auch mit 200+ Büchern gut aussehen
- Suche findet manche Bücher nicht („10 Blind Dates für die große Liebe“) → Quellen kombinieren, Cover doppelt prüfen
- Hübscher Platzhalter statt grauem Cover (Bibliothek & überall); fehlende Cover automatisch nachladen
- Listen-Filter: nur ein „Alle“ + Auswahl (Gelesen/Ungelesen/Besitz)
- Lese-Timer: Cover nicht unscharf, Kreis-Dial zieht nicht das Sheet runter, nach „fertig gelesen“ automatisch Leseprotokoll/Bewertung, Timer läuft bei ausgeschaltetem Bildschirm weiter, alles rund ums Lesen schicker + einklappbar im Buchdetail
- Reihen: in der kompletten Bücherwelt (nicht nur eigene Bibliothek) prüfen, sonst „Einzelne Bücher“ – ganz oben bei den Reihen; beim Import mitdenken
- Import: Fortschrittsanzeige + „bitte warten“; Kindle/Tolino-Links statt langer Text
- Bücherliste lokal cachen; gute Bedienung beim neuen Buch eintragen

## User Choices
- Bestehenden Code (GitHub `conflict_031026_1415`) klonen und überarbeiten; Web-App bleibt (CRA/craco)
- .env-Werte übernommen (GOOGLE_CLIENT_ID), Mongo lokal
- Suche: mehrere Quellen (Google Books + Open Library + DNB), Cover-Doppelcheck
- Kindle/Tolino: Datei-Import bleibt, zusätzlich Links zu den Bibliotheken

## Architecture
- Backend FastAPI `/app/backend`: `server.py`, `models.py`, `genres.py`, `sources.py` (Google/OpenLibrary/DNB, Cover-Suche, Reihen-Erkennung), `jobs.py` (Hintergrund-Jobs + `/api/jobs/{id}`), `routers/{auth,books,sessions,imports,search,taxonomy,stats,enrich}.py`
- Frontend CRA `/app/frontend/src`: `pages/*`, `components/{layout(JobProgress…), books(Cover mit Fallback/hiRes, ProgressRing pointer-events), calendar, library, ios}`, `hooks/useBooks.js` (React Query, persistiert in localStorage)
- Preview: supervisor `yarn expo start` → `scripts/dev-server.sh` → craco auf Port 3000
- Mongo: users, user_sessions, books (+cover_checked, series_checked), taxonomy, reading_sessions, search_cache, jobs (TTL 3 Tage)
- Env: `GOOGLE_BOOKS_API_KEY` optional (ohne Key ist Google aus der Cloud oft 429 → DNB/OpenLibrary fangen das ab)

## Implemented
- 2026-06 Iteration 1+2, 2026-10 Iteration 3: siehe Git-Historie / frühere PRD
- 2026-06 Iteration 4:
  - Suche: Google + Open Library + DNB parallel, Dedupe (ISBN / Titel+Autor), Felder zusammenführen, Relevanz-Ranking, `intitle:`-Variante, ohne Sprachfilter als Zusatz; `/api/search/cover` Cover-Doppelcheck
  - Statistik: `period=month|quarter|year|all`, Buckets (Wochen/Monate/Jahre), `rated_books` → Bewertungs-Zeilen aufklappbar + Link `/books?rating=n`
  - Reihen: `series_from_title`-Heuristik beim Anlegen/Import, DNB-490 + Google seriesInfo per Job (`/api/enrich/series`), „Einzelne Bücher“ (`series=__none__`) als erste Zeile der Reihen-Gruppe
  - Cover: Gradient-Fallback (Titel + Autor), 1×1-Platzhalter-Erkennung, hiRes für Google-Thumbnails, Job `/api/enrich/covers` (prüft auch Google-Content-URLs), Cover-Suche im Formular (Cover antippen)
  - Import: `POST /api/import/{kind}` → `{job_id}`, Phasen import → covers → series, Fortschritt via `GET /api/jobs/{id}`; Kindle-/Tolino-Links
  - Timer: Pointer-Events + `data-vaul-no-drag` am Kreis, Wake-Lock-Toggle, visibilitychange-Refresh, ±-Buttons, „Buch fertig gelesen“ → nach Speichern öffnet sich FinishSheet automatisch (router state)
  - Buchdetail: einklappbare `ReadingCard` (Ring, Fortschritt, Lesezeit, Sessions), Zustand in localStorage
  - Layout: Header kompakter (`pt-status` 6px/safe-area), `pb-tabbar` statt pb-40; Kalender nur Cover (Lane 44px)
  - Listen: eine Chip-Reihe (Alle/Gelesen/Ungelesen/Besitz) mit Zählern
  - Testing: iteration_1 – Backend 19/19, Frontend alle Flows OK; Nested-Button-Warnung in Stars behoben

## Backlog
- P1: `GOOGLE_BOOKS_API_KEY` in Render setzen (bessere Google-Trefferquote/Beschreibungen)
- P1: Mehrere Lesedurchgänge als eigene Protokolle; Reihen-Vorschläge im Formular aus DNB live
- P2: Jahres-Leseziel, Lesestreak, Hörbuch-Timer, Service Worker Offline, Apple-Login

## 2026-10-03 – Neue Rückmeldung des Users (noch offen, Details in README.md „Offene Verbesserungsliste“)
Cover lokal/dauerhaft speichern · kaputtes DNB-Cover („?“) · eigenes Cover hochladen (bleibt dauerhaft) · Vollbild unten · Untertitel im Sticky-Header beim Scrollen ausblenden · Statistik-Zeitraum als Button mit Auswahl · Kreis-Dial lagt · weißer Kasten hinter Google-Button · Besitz gesetzt → Wunschliste → Zu Lesen · Listen zeigen nur 20 Bücher / Infinite Scroll.
User-Anweisung: zuerst NUR README schreiben (erledigt), danach die Punkte umsetzen.
