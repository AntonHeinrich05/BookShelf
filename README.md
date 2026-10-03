# BookShelf · Update 3.0

Privater Lese-Tracker als bestehende **React-Web-App/PWA + FastAPI + MongoDB**. Dieses Update baut auf dem Branch `conflict_031026_2152` auf; Navigation, iOS-artige Gestaltung, Dark/Light Mode und vorhandene Nutzer-/Buchmodelle bleiben erhalten.

**Stand: 03.10.2026.** Code und Tests wurden in einer getrennten Vorschau bearbeitet. Die laufende Render-App, ihre Datenbank und der ursprüngliche GitHub-Branch wurden dabei nicht verändert. Vorhandene Bücher müssen nicht neu importiert werden.

## Was in diesem Update umgesetzt wurde

| Priorität aus der ursprünglichen Liste | Ergebnis |
|---|---|
| 1. Cover dauerhaft speichern | Cover der Bibliothek werden einmal geprüft, verkleinert und als Bilddaten in MongoDB gespeichert – **nicht auf der flüchtigen Render-Festplatte**. Anzeige über geschützte `/api/covers/{book_id}`-Adressen. Bereits vorhandene externe Cover werden beim ersten Anzeigen übernommen; neue Bücher zusätzlich unmittelbar nach dem Speichern im Hintergrund. |
| 2. Defekte DNB-Cover / „?“ | Auch Such-Cover kommen über einen geprüften Backend-Bildabruf. Kein direkter Hotlink vom Browser zu DNB/Google nötig. Ungültige Bilder, leere Katalogbilder und 1×1-Pixel werden verworfen; Titel/Autor-Fallback statt kaputtem Bild. |
| 3. Eigenes Cover | **„Cover ersetzen“** in der Buchansicht: JPG, PNG oder WebP bis 8 MB / 24 Megapixel. Ein eigenes Cover bleibt geschützt vor automatischer Suche und gewöhnlichen Buchänderungen. |
| 4. PWA-Rand unten | `html`, `body` und `#root` nutzen volle Höhe, `100dvh`, passende Theme-Hintergründe und Safe-Area-Abstände. Pinch-Zoom ist wieder erlaubt. Eine echte iPad-Standalone-Prüfung bleibt sinnvoll; Browserautomatisierung ersetzt kein reales iOS-Gerät. |
| 5. Sticky-Header | Untertitel verschwinden beim Scrollen; die Überschrift wird kompakt. Unterschiedliche Ein-/Ausschaltschwellen vermeiden Flackern. |
| 6. Statistik-Zeitraum | Ein Auswahlbutton im Header ersetzt die Chip-Reihe. Monat, Quartal, Jahr und Gesamt bleiben verfügbar. |
| 7. Timer-Kreis | Direkte Kreis-/Knopfaktualisierung während des Ziehens, React-Aktualisierung höchstens einmal je Animation-Frame, keine verzögernde Strichanimation. Zusätzlich Tastatursteuerung. |
| 8. Google-Button | Theme-abhängiges Original-Google-Design, transparente umgebende Fläche, berechnete Breite und stabile Initialisierung. Vollständiger Google-Login in dieser Vorschau nicht geprüft: hier fehlt die bestehende `GOOGLE_CLIENT_ID`. |
| 9. Wunschliste → Zu Lesen | Beim Setzen von „Im Besitz“ oder „Ausgeliehen“ wird ein Wunschlistenbuch automatisch nach „Zu Lesen“ verschoben, einschließlich Formular und Import. |
| 10. Mehr als 20 Bücher | Echtes Nachladen sowohl in der Katalogsuche als auch in Bibliothekslisten. DNB wird **auch auf späteren Suchseiten** abgefragt. Bibliotheksfilter und Gesamtzahlen werden unabhängig von der geladenen Seite berechnet. |

**Aktualisierter Nutzerwunsch:** Die wirkungslosen Schaltflächen „Cover auffrischen“ / „Cover suchen“ wurden aus Bibliothek und Formular entfernt. Cover werden automatisch gesichert; ein fehlendes Cover lässt sich durch einen eigenen Upload ergänzen. Der bisherige `/api/enrich/covers`-Endpunkt bleibt aus Kompatibilitätsgründen bestehen, überschreibt aber keine gespeicherten/eigenen Cover.

## Büchersuche: Deutsch, schnell und ehrlich

- **Google Books, Open Library und Deutsche Nationalbibliothek parallel.** Deutsch ist anfangs ausgewählt; Alle/Englisch bleiben möglich, die Auswahl wird gemerkt.
- Deutsche Titel, Autor:innen und ISBN mit/ohne Bindestriche; DNB-Sprachindex `spr` und ISBN-Index `num` wurden gegen die echte SRU-Explain-Antwort geprüft. Buch-, Online- und Disc-Datensätze werden berücksichtigt.
- Pro Quelle gilt ein Zeitbudget von maximal fünf Sekunden. Ein Ausfall blockiert die anderen Kataloge nicht; die Oberfläche zeigt ausgefallene Quellen an.
- Suchanfragen werden verzögert beim Tippen gestartet, überholte Browseranfragen abgebrochen, identische gleichzeitige Anfragen zusammengeführt und Ergebnisse zwischengespeichert. Teilweise fehlgeschlagene Suchergebnisse werden nur kurz gecacht.
- ISBN-10/13-Deduplizierung; verschiedene Ausgaben bleiben sichtbar statt pauschal nach kurzem Titel zu verschwinden. Bereits gespeicherte Treffer öffnen das vorhandene Buch.
- Suchzahlen zeigen tatsächlich geladene Treffer. Anbieter-Gesamtzahlen sind nur Schätzungen mit Überschneidungen und werden nicht als exakte globale Buchanzahl ausgegeben.
- **Kein öffentlicher Katalog enthält garantiert jedes existierende Buch.** Insbesondere sehr neue, vergriffene oder selbst veröffentlichte Titel können fehlen. Manuelle Einträge bleiben möglich. Tippfehler werden weiterhin in der eigenen Bibliothek toleriert; die externe Suche benutzt bewusst keinen englischen Rechtschreibdienst für deutsche Titel mehr.
- Im Live-Test gefunden: **„10 Blind Dates für die große Liebe“**, zwei DNB-Ausgaben mit ISBN `9783732578559` und `9783846600917`. Google war dabei ohne konfigurierten Books-Schlüssel nicht erreichbar; DNB lieferte die Treffer trotzdem.

### Optionale Google-Konfiguration

`GOOGLE_BOOKS_API_KEY` verbessert die Zuverlässigkeit der Google-Quelle. Er ist **nicht** derselbe Wert wie `GOOGLE_CLIENT_ID` für die Anmeldung. Ohne Books-Schlüssel funktionieren die übrigen Quellen; Google kann aus Cloud-Netzen Kontingent-/429-Fehler liefern. Schlüssel bleiben ausschließlich im Backend.

## Cover-Speicherung im Detail

- Separate `covers`-Collection: Besitzer, Buch-ID, Inhaltsrevision und komprimierte JPEG-Daten, maximal **150 KB**, maximal **400 × 600 Pixel**. Orientierung wird korrigiert, Metadaten werden entfernt. Das gesamte Cover bleibt sichtbar und wird nicht beschnitten.
- Referenzen sind relative API-Pfade. Der Browser verwendet dafür immer die konfigurierte `REACT_APP_BACKEND_URL` und authentifizierte Anfragen; API-Token stehen nie in Bild-URLs.
- Berechtigungsprüfung **vor** der Bildausgabe. Eine andere Person erhält weder Buch noch Cover. Beim Löschen eines Buchs werden dessen Cover und Sessions entfernt.
- Erfolgreiche Bilder werden im Browser zusätzlich in der Cache API pro Konto abgelegt. Beim Kontowechsel werden private Daten getrennt, beim Abmelden lokale private Caches entfernt. Nicht verfügbare Cache API verhindert nicht die normale Anzeige.
- Ein Inhaltswechsel erzeugt eine neue URL-Revision. Browser-Cache und ETag verhindern unnötige Übertragungen; bereits gespeicherte Bibliothekscover werden nicht erneut beim Anbieter geladen.
- Such-Thumbnails in `cover_previews` besitzen einen kurzen Datenbank-TTL, **Bibliothekscover dagegen keinen TTL**. Ein gefundenes Suchbild kann direkt in die dauerhafte Buchablage übernommen werden.
- Nur bekannte HTTPS-Bildhosts, geprüfte Weiterleitungen, begrenzte Downloadgröße und echte Bilddecodierung. Ungeeignete beliebige URLs werden nicht vom Server aufgerufen.
- Bei nicht auffindbaren Covern werden wiederholte externe Versuche sieben Tage zurückgestellt. Das vorhandene/eigene Cover wird nie durch einen fehlgeschlagenen Versuch gelöscht.
- **Grenze:** Browser dürfen lokale Caches bei Speichermangel löschen. Dann kommt das Bild erneut aus der eigenen Datenbank, nicht aus dem Buchkatalog. Dauerhaftigkeit hängt vom Erhalt/Sichern dieser MongoDB ab.

## Zusätzliche Verbesserungen aus der Durchsicht

### Daten & Zuverlässigkeit
- **CSV-Rückimport:** Reihen und Teilnummern, Genres, Orte, Sammlungen, Besitz, Veröffentlichungsjahr, Seiten, Lesedaten, Notizen, Markierung, Lesedurchgänge, Fortschritt, Hörbuchlänge und gespeicherte Lesezeit werden korrekt zugeordnet. Listenfelder werden in neuen eigenen CSVs als JSON-Arrays transportiert, damit Kommas/Semikolons in Namen erhalten bleiben. Alte CSVs sowie komma-, semikolon- und tabulatorgetrennte Dateien werden weiter akzeptiert.
- **Große Importe:** Bekannte Genre-/Reihen-/Ortsnamen werden einmal pro Import statt mehrmals pro Buch geladen. Bookshelf-Genrezuordnungen aus der Collections-Datei gehen nicht mehr verloren.
- **Bessere Reihen-Erkennung:** Zahlen allein erzeugen keine Reihe. Explizite Namen wie `Titel (Meine Reihe, Band 2)` bleiben erhalten. Katalogabgleiche prüfen Titel und Autor genauer; gängige Verlags-/Taschenbuchnummerierungen werden nicht als Romanreihe übernommen. Bereits zugeordnete Reihen bleiben unangetastet.
- **Korrekte Gruppenzahlen:** Genre-/Reihen-/Autoren-Zahlen auf der Bibliotheksseite schließen Wunschlistenbücher ebenso aus wie die dahinterliegende Bibliotheksliste.
- **Timer-Datenschutz:** Kein vorheriger Kontotimer nach Abmeldung. Bearbeiten eines Buches ersetzt nicht mehr das komplette Dokument und überschreibt dadurch keine gleichzeitig gespeicherten Cover oder Lesezeiten.
- **Timer-Daten:** Doppelte Übertragung derselben Session wird abgefangen. Löschen einer Session zieht nur ihre Zeit ab; importierte historische Lesezeit bleibt erhalten. Prozentfortschritt ohne Seitenzahl wird gespeichert. Der Timer pausiert beim Öffnen des Abschlussdialogs.
- **Statistik:** Historische importierte Zeiten werden nicht unterschlagen; Zeit wird dem protokollierten Datum zugeordnet. Durchschnittliche Zeit pro abgeschlossenem Buch wird getrennt von allen Aktivitäten eines Zeitraums berechnet. Ungültige ältere Datumswerte bringen die Statistik nicht mehr zum Absturz.
- **Jobs:** Wiederholtes Antippen einer laufenden Reihen-Erkennung erzeugt keinen weiteren identischen Job. Durch einen Serverneustart unterbrochene Jobs werden als unterbrochen angezeigt, statt endlos „läuft“ zu melden. Ein erneuter Import erkennt bereits importierte Bücher.

### Schutz & Bedienung
- Private React-Query-, Cover- und Timer-Caches werden beim Abmelden bereinigt. Alte Cacheformate werden invalidiert.
- HTML-Beschreibungen werden als Text dargestellt; fremdes HTML wird nicht mehr direkt in die Buchansicht eingesetzt.
- Validierung für leere Titel, unzulässige Statuswerte, negative Seiten/Zeiten, ungültige Lesedaten, große Uploads und übergroße ZIP-Inhalte.
- Passwort-Hashing blockiert nicht die Suchanfragen; neue Passworthashes berücksichtigen auch lange Passwörter vollständig. Vorhandene Hashes bleiben kompatibel. Anmeldeversuche sind begrenzt.
- Kontobootstrap verwendet einen normalen Sitzungsstatus statt erwarteter 401-Konsolenfehler; Chart-Größen werden vor der Anzeige gemessen.
- Datenbankindizes für Buchseiten, private Cover, Sitzungen und Cache-Laufzeiten; stabile Sortierung an Seitengrenzen.

## Offene Verbesserungen – priorisierter, ergänzter Backlog

### P0 – Voraussetzung für unveränderte private Daten
- MongoDB inklusive `covers` regelmäßig sichern. **CSV ist keine vollständige Datenbanksicherung**: Bilder und einzelne Session-Protokolle sind dort nicht eingebettet. Ein importierter alter `/api/covers/...`-Verweis überträgt insbesondere keine privaten Bilder zwischen Konten.
- Für ein bestehendes System dieselbe produktive `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS` und Google-Konfiguration beibehalten; diese Vorschau enthält nur getrennte Testkonten.

### P1 – Nächste sinnvolle Ausbaustufe
- Vollständiger portabler Backup-/Restore-Export inklusive Coverdateien, Sessions und Zuordnungen (zusätzlich zur CSV).
- Reihen-Vorschläge mit bestätigbarer Vorschau und Änderungsverlauf; aktuell vorsichtige automatische Übernahme belastbarer Treffer, keine vollständige Garantie.
- Neustartfeste Job-Warteschlange mit Wiederaufnahme bei mehreren Serverprozessen. Aktuelle Hintergrundjobs laufen in einem API-Prozess; Unterbrechungen werden angezeigt, nicht automatisch fortgesetzt.
- Optionalen Google-Books-Schlüssel ergänzen; echte Google-Anmeldung mit bestehender Client-ID und freigeschalteten Origins prüfen.
- Reales iPhone/iPad im installierten Standalone-Modus prüfen (Tastatur, Home-Indikator, Safe Areas, Google-Button). HEIC-Dateien ggf. per zusätzlichem Decoder unterstützen; derzeit JPG/PNG/WebP.
- Datenbankgestützte Volltextsuche/Aggregationen für sehr große persönliche Bibliotheken: paginierte ungefilterte Listen arbeiten bereits in MongoDB; fehlertolerante lokale Suche sowie manche Übersichten laden noch bis zu 20.000 Bücher.
- Passwort vergessen / E-Mail-Verifizierung / kontoweite Sitzungsverwaltung; derzeit bestehende E-Mail-Anmeldung und Google-Anmeldung.

### P2 – Produktideen
- Jahresleseziel und Lesestreak.
- Reihenlücken mit „fehlenden Band auf Wunschliste setzen“.
- Mehrere Lesedurchgänge als getrennte vollständige Protokolle.
- Vollständige Offline-App mit App-Shell und Offline-Änderungswarteschlange. **Bildcache allein ist kein vollständiger Offline-Modus.**
- Quellenspezifische Ratensteuerung/Circuit-Breaker für sehr viele gleichzeitige Nutzer, Cache-Budget/alte Bildrevisionen aufräumen und weitergehende Barrierefreiheitsprüfung.

## Architektur

```text
backend/
  server.py                 App, CORS, Indizes, Router
  database.py               bestehende MongoDB-Verbindung
  auth_utils.py, models.py   Sessions, Passwörter, Datenmodelle
  sources.py                Google Books / Open Library / DNB, MARC, Reihen
  cover_store.py            Bildprüfung, Komprimierung, dauerhafte Speicherung
  book_pagination.py        Seiten/Filterzahlen per MongoDB-Aggregation
  jobs.py                   Import-/Anreicherungsfortschritt
  routers/
    auth.py, books.py, covers.py, search.py, enrich.py
    imports.py, sessions.py, stats.py, taxonomy.py
  tests/backend_test.py      ausführbare API-Regressionssuite
frontend/
  src/context/              Anmeldung, Theme, kontogetrennter Lese-Timer
  src/hooks/useBooks.js      Abfragen, echte Seiten, Änderungen
  src/hooks/useCoverSource.js authentifizierter Bildabruf + Cache API
  src/components/books/     Cover, CoverUpload, LoadMore, ProgressRing, Formulare
  src/components/layout/    AppShell, kompakter PageHeader, Navigation
  src/pages/                Bibliothek, Suche, Bücher, Kalender, Statistik, Import
```

### Wichtige API-Verträge

- `GET /api/books` bleibt ohne `limit` eine Liste für bestehende Ansichten. Mit `skip` und `limit` liefert es `{ items, total, has_more, next_skip, summary, counts }`.
- `GET /api/search?q=...&lang=de&start=0`: `items`, `sources`, `degraded_sources`, `has_more`, `next_start`. `start` zählt die Quellenseiten in Schritten von 20.
- `GET /api/covers/{book_id}?v={revision}`: privates JPEG, ETag, Browser-Cache.
- `POST /api/books/{book_id}/cover`: multipart-Feld `file`, aktualisiertes Buch zurück.
- `GET /api/cover-preview?url=...`: geschützter, eingeschränkter Katalog-Bildabruf.
- `POST /api/books/{id}/sessions`: optionales `client_id` macht Wiederholungen idempotent; `progress_percent` für Bücher ohne bekannte Seitenzahl.
- Import: `POST /api/import/{bookshelf|csv|kindle}` → Job-ID; `GET /api/jobs/{id}` zeigt Fortschritt und Fehler.

## Konfiguration & Start

Kein Expo-Projekt. Bestehende `frontend/scripts/dev-server.sh`-Kompatibilität bleibt erhalten, normaler Start ist CRA/craco.

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

cd frontend
yarn install --frozen-lockfile
yarn start
```

Backend-Umgebung:
- `MONGO_URL`, `DB_NAME`: bestehende Datenbank; keine Zugangsdaten im Repository.
- `CORS_ORIGINS`: erlaubte Frontend-Origins, kommagetrennt. `*` wird **nicht** als Freigabe privater Cookie-Anfragen verwendet.
- `APP_ORIGIN`: zusätzliche ausdrücklich erlaubte Origin, insbesondere für die getrennte Vorschau.
- `GOOGLE_CLIENT_ID`: vorhandene Google-Identity-Client-ID; optional `GOOGLE_BOOKS_API_KEY` für die Suche.
- Vorhandene `KEEP_ALIVE_URL`-Option bleibt kompatibel. Ein Selbstping ist keine Garantie gegen das Einschlafen eines externen Dienstes.

Frontend: `REACT_APP_BACKEND_URL`. Alle API- und privaten Bildanfragen verwenden diesen Wert. Eine Änderung erfordert einen neuen Frontend-Build.

### Bestehender Render-Aufbau

`render.yaml` bleibt kompatibel: Python-Backend, React Static Site mit SPA-Rewrite.
- Backend Root: `backend`; Build: `pip install -r requirements.txt`; Start: `uvicorn server:app --host 0.0.0.0 --port $PORT`; Health: `/api/health`.
- Frontend Root: `frontend`; Build: `yarn install --frozen-lockfile && yarn build`; Ausgabe: `build`; Rewrite `/*` nach `/index.html`.
- Umgebungswerte müssen zum vorhandenen System passen. Keine automatische Verbindung dieser Testumgebung zur produktiven Datenbank.
- MongoDB-Zugang mit eingeschränkten Rechten/TLS und passenden Netzwerkfreigaben verwenden. Die Datenbank muss unabhängig vom temporären Webserver-Dateisystem bestehen bleiben.

### Bestehender Google-Login

Google Cloud Console → APIs & Dienste → OAuth-Client-ID (Webanwendung). Die tatsächliche Frontend-Origin unter „Autorisierte JavaScript-Quellen“ eintragen. Client-ID als `GOOGLE_CLIENT_ID` im Backend setzen. Ein Client-Secret ist für den verwendeten GIS-ID-Token-Login nicht erforderlich.

### Kindle / Tolino

Der vorhandene Kindle-Export läuft im eigenen Browser mit der eigenen Amazon-Anmeldung und wird als JSON importiert. Es gibt hier keine direkte Amazon-/Tolino-Synchronisierung. Tolino/Goodreads können weiterhin per CSV übernommen werden; vorhandene Links bleiben erhalten.

## Prüfung

- Produktionsbuild und Python-Kompilierung erfolgreich.
- Abschließende API-/Datenregressionssuiten: **25/25 erfolgreich**, auch mit frisch installierten, auf tatsächlich benötigte Pakete beschränkten Backend-Abhängigkeiten (`test_reports/pytest/final_results.xml`).
- Darunter vollständiger CSV-Metadaten-Roundtrip inkl. Kommas/Semikolons in Listenfeldern; 160-Bücher-Import mit nur einem Bibliotheksabruf und vier Taxonomieabrufen; geschützte Uploads, ETag 304, unveränderte eigene Cover nach Bearbeitung/Anreicherung und korrekte Filterzahlen.
- Authentifizierte Desktop-/Mobilansichten, Anmeldung, Suche, manuelles Hinzufügen, Statistik-Auswahl und Kontotrennung geprüft.
- Browserprüfung: echtes Cover auf Desktop/Telefon/Tablet, keine erneute Cover-API-Anfrage bei Navigation aus dem Bildcache, Upload nach Neuladen erhalten, private Caches nach Abmeldung entfernt. Prozent-Timer ohne Seitenzahl inklusive Tastaturbedienung und Speichern von 63 % erfolgreich. Fehlende Bücher erscheinen ohne wiederholte 404-Warteversuche.
- Echter DNB-Coverabruf geprüft: `379 × 599`, `41.646 Bytes`; gespeicherter erneuter API-Abruf im Test ungefähr `0,12 s` (Momentaufnahme, keine allgemeine Latenzgarantie).
- Testberichte: `test_reports/`; Zugang zu den getrennten Testkonten nur in der ignorierten Datei `memory/test_credentials.md`.
- Keine simulierten Buchkataloge oder Upload-Funktionen im Anwendungscode. Externe Dienste können unabhängig von der App ausfallen.