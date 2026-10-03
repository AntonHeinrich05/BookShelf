# BookShelf

Lese-Tracker als Fullstack-Webapp (React + FastAPI + MongoDB), installierbar als PWA auf iPhone/iPad/Android.

> **Für einen neuen Account / neuen Agenten – bitte zuerst lesen:**
> Dieses Projekt ist eine **Web-App (CRA/craco), KEIN Expo**. Die Vorschau-Umgebung startet per supervisor `yarn expo start`,
> das Skript `frontend/scripts/dev-server.sh` leitet das auf den craco-Dev-Server (Port 3000) um – nicht ändern.
> Der Stand, Architektur und Verlauf stehen in `memory/PRD.md`, Test-Login in `memory/test_credentials.md`.
> **Die offene Verbesserungsliste steht direkt hier unten – in dieser Reihenfolge abarbeiten.**

---

## 🔧 Offene Verbesserungsliste (Stand 03.10.2026 – Wunschliste des Users, noch NICHT umgesetzt)

Alle Punkte wurden vom User gewünscht und sind noch offen. Priorität = Reihenfolge. Nach jedem Punkt mit dem Testing-Agent testen.

### 1. Cover lokal & dauerhaft speichern (wichtigster Punkt, behebt auch Bug #2)
- **Wunsch:** Alle Cover der Bibliothek sollen lokal gespeichert sein, damit sie nicht jedes Mal neu laden – und dauerhaft bleiben.
- **Problem heute:** `cover_url` zeigt auf externe Server (Google, Open Library, DNB). Die laden langsam, verschwinden oder blocken Hotlinking.
- **Umsetzung:**
  - Backend: Endpoint `GET /api/covers/{book_id}` (oder beim Anlegen/Import/Enrich) lädt das Bild einmal herunter und speichert es dauerhaft.
    Ablage: **Emergent Object Storage** (Playbook über `integration_expert` holen) – alternativ als Binary in Mongo (GridFS/`covers`-Collection, max. ~150 KB pro Bild, auf 400×600 verkleinern, z. B. mit Pillow).
  - `cover_url` im Buch danach auf die eigene URL setzen (`/api/covers/{id}.jpg`) → immer gleiche Domain, kein Hotlink-Problem.
  - Frontend: Cover-Komponente (`components/books/Cover.jsx`) zusätzlich im Browser cachen (Service Worker mit Cache-First für `/api/covers/*`, oder `Cache API` manuell) → offline/sofort sichtbar.
  - Der Job `POST /api/enrich/covers` (`routers/enrich.py`) soll nach dem Finden auch gleich herunterladen/speichern.

### 2. Bug: Cover wird als „?“ (kaputtes Bild) angezeigt
- **Beobachtet:** „10 Blind Dates für die große Liebe“ – Cover-URL `https://portal.dnb.de/opac/mvb/cover?isbn=…` lädt per curl, aber im iPad-Browser erscheint ein kaputtes Bild-Symbol statt des Fallback-Verlaufs.
- **Ursache (vermutlich):** DNB liefert bei fremdem `Referer` eine HTML-Seite/leeres Bild; iOS Safari feuert nicht zuverlässig `onError`.
- **Fix:** Cover durch das Backend laden/proxyen (siehe Punkt 1) **und** in `Cover.jsx` `referrerPolicy="no-referrer"` setzen sowie nach `onLoad` prüfen (`naturalWidth`); bei 0 → Fallback (`CoverFallback`).

### 3. Eigenes Cover hochladen / ersetzen (kleiner Button in der Buchansicht)
- **Wunsch:** In der Buchansicht ein kleiner Button „Cover ersetzen“ → Bild aus Fotos/Dateien wählen. Das eigene Cover muss **dauerhaft bleiben** und darf von der automatischen Cover-Suche **nie überschrieben** werden.
- **Umsetzung:** `POST /api/books/{id}/cover` (multipart, Bild verkleinern, speichern wie Punkt 1), Feld `cover_custom: true` am Buch setzen. In `routers/enrich.py` `fix_covers` und beim Import Bücher mit `cover_custom` überspringen. Frontend: Button auf dem Cover in `BookHero` (`components/books/BookDetailSections.jsx`), `<input type="file" accept="image/*">`.

### 4. Vollbild / Rand unten (PWA)
- **Wunsch:** Die Web-App soll den ganzen Bildschirm nutzen, auch nach unten (kein Rand unten).
- **Prüfen:** `public/index.html` hat `viewport-fit=cover` + `apple-mobile-web-app-capable`; `index.css` nutzt `100dvh`. Auf iPad erscheint unten trotzdem ein Rand → `html, body, #root { height: 100%; min-height: 100dvh }`, `body { background: var(--c-canvas) }` prüfen, `theme-color` passend zum Theme (schwarz/weiß) setzen, `manifest.json` → `"display": "standalone"` (bzw. `fullscreen`) kontrollieren. Safe-Area unten nur per `env(safe-area-inset-bottom)` padden, nicht als Rand.

### 5. Sticky-Header verkleinern: Untertitel beim Scrollen ausblenden
- **Wunsch:** Oben bei „Bibliothek“ steht „Hallo Anton“, beim Kalender „2 beendet · … Seiten im Oktober“. Diese kleine Zeile bleibt beim Scrollen stehen und kostet Platz.
- **Umsetzung:** In `components/layout/PageHeader.jsx`: Untertitel (und ggf. große Überschrift) nur zeigen, solange `#root.scrollTop < ~24px`; beim Scrollen auf kompakte einzeilige Variante schrumpfen (Scroll-Listener auf `#root`, da nur `#root` scrollt). Alternativ Untertitel nicht sticky machen (außerhalb des `<header>`).

### 6. Statistik: Zeitraum als Button mit Auswahl statt Chip-Reihe
- **Wunsch:** Statt der Chips „Letzter Monat / 3 Monate / Letztes Jahr / Gesamt“ ein Button (zeigt aktuellen Zeitraum), der beim Antippen die Auswahl öffnet.
- **Umsetzung:** `pages/StatsPage.jsx`: `PERIODS` (aus `lib/constants.js`) in ein Dropdown/Bottom-Sheet (vorhandene `Drawer`- oder `DropdownMenu`-Komponenten unter `components/ui/`) packen; Button rechts im Header (`PageHeader right=…`).

### 7. Lese-Timer: Kreis-Dial reagiert verzögert („lagt“)
- **Wunsch:** Beim Ziehen am Kreis (Seiten einstellen) kommt die Anzeige nicht schnell genug hinterher.
- **Umsetzung:** `components/books/ProgressRing.jsx`: Wert während des Ziehens in einem `useRef` + direktem DOM-Update (strokeDashoffset, Knopfposition, Zahl) setzen und `onChange` nur gedrosselt (requestAnimationFrame) auslösen; CSS-`transition` auf dem Kreis beim Ziehen deaktivieren (`.dragging` → `transition: none`). Zahl-Anzeige ggf. aus dem Ring selbst rendern statt über Parent-State.

### 8. Google-Login: weißer Kasten hinter dem Google-Button
- **Beobachtet:** Auf der Login-Seite liegt ein weißes Rechteck hinter dem „Über Google anmelden“-Button (Dark Mode).
- **Umsetzung:** `components/auth/GoogleSignIn.jsx`: Google-Identity-Button mit `theme: "filled_black"` rendern (oder bei hellem Theme `outline`), Container ohne weißen Hintergrund, Breite exakt setzen (`width` in px, kein `100%`), oder eigenen Button stylen und `google.accounts.id.prompt()` / `renderButton` versteckt nutzen. Mit `useTheme()` Theme-abhängig.

### 9. Status-Automatik: Besitz → von Wunschliste zu „Zu Lesen“
- **Wunsch:** Wenn ein Buch auf der Wunschliste steht und der Besitz auf „Im Besitz“ (oder „Ausgeliehen“) gesetzt wird, soll der Status automatisch auf „Zu Lesen“ wechseln.
- **Umsetzung:** Backend `routers/books.py` → `update_book`: wenn `existing.status == "wishlist"` und neues `ownership in ("owned", "borrowed")` → `status = "to_read"`. Gleiches in `normalize` beim Anlegen (Wunschliste + im Besitz → zu lesen). Frontend-Toast „Zu Lesen verschoben“.

### 10. Listen zeigen nur 20 Bücher (z. B. pro Genre) – kein Nachladen beim Scrollen
- **Beobachtet:** In einer Liste (z. B. Genre) erscheinen nur 20 Bücher, weiter unten kommt nichts nach.
- **Prüfen/Fix:** Backend `GET /api/books` hat kein Limit (20000) – das Limit kommt wahrscheinlich aus dem **Import/Enrich** (nur ein Teil der Bücher hat das Genre) **oder** aus der Suche (`/api/search` liefert 20 pro Quelle, `start`-Parameter wird im Frontend nicht genutzt). Umsetzung: in `pages/BookListPage.jsx` und `pages/SearchPage.jsx` Infinite Scroll (IntersectionObserver am Listenende, `useInfiniteQuery` mit `start`/`skip`), Backend `GET /api/books?skip=&limit=` ergänzen und `total` zurückgeben. Zusätzlich prüfen, ob `Genres` beim Bookshelf-Import korrekt auf alle Bücher gesetzt wurden.

### Danach / Backlog (nice to have)
- Jahres-Leseziel mit Fortschrittsring, Lese-Streak, Reihen-Lücken („Teil 3 fehlt“ → Wunschliste)
- `GOOGLE_BOOKS_API_KEY` in Render setzen (Google blockt Cloud-IPs ohne Key oft mit 429; DNB/Open Library fangen das ab)
- Mehrere Lesedurchgänge als eigene Protokolle

### Was bereits erledigt ist (Iteration 4, 03.10.2026)
Suche über Google + Open Library + DNB zusammengeführt (`backend/sources.py`, `routers/search.py`) · Statistik-Zeiträume (`period=month|quarter|year|all`) + Bewertungen aufklappbar · Reihen-Erkennung über DNB/Google (`routers/enrich.py`) + „Einzelne Bücher“ oben · Import als Hintergrund-Job mit Fortschritt (`jobs.py`, `/api/jobs/{id}`) · Cover-Fallback (Farbverlauf) + Cover-Suche im Formular · Timer-Seite neu (Wake Lock, Kreis zieht Sheet nicht mehr runter, „fertig gelesen“ öffnet Leseprotokoll) · einklappbare Lese-Karte im Buchdetail · Kalender nur Cover · Header kompakter · eine Chip-Reihe in Listen.

---

## Features
- Bibliothek mit Lesestatus (Wunschliste, Zu Lesen, Lesen, Fertiggestellt, Abgebrochen, Markiert)
- Büchersuche mit Cover über Google Books, manuelle Einträge möglich
- Format (Buch, eBook, Hörbuch), Besitz (Im Besitz, Ausgeliehen, Nicht im Besitz), Genres (automatisch erkannt, bearbeitbar)
- Serien mit Teil-Nummer („Teil 1“ überall sichtbar), Sammlungen, Kategorien, Orte
- Autoren-Übersicht (wie viele Bücher gelesen → Detailliste)
- Seiten-/Prozent-Fortschritt, Start-/Enddatum, Bewertung 1–5, Notizen
- Lesekalender mit Covern: Start, Ende und Lesezeitraum pro Buch
- Statistiken nach Zeitraum (letzter Monat, 3 Monate, letztes Jahr, gesamt), Bewertungen aufklappbar
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
    search.py        /api/search (Google + Open Library + DNB zusammengeführt), /api/search/cover
    enrich.py        /api/enrich/{covers|series|all} (Hintergrund-Jobs: Cover nachladen, Reihen erkennen)
    taxonomy.py      /api/taxonomy/{kind}, /api/authors
    stats.py         /api/stats?period=month|quarter|year|all
  sources.py         Externe Quellen (Google Books, Open Library, DNB-SRU), Cover-Suche, Reihen-Heuristik
  jobs.py            Job-Collection + GET /api/jobs/{id} (Fortschritt für Import/Enrich)
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
