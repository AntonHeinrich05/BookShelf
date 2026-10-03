# BookShelf – Produktstand

## Originaler Auftrag (03.10.2026)
„das ist meine vollständig funktionierende fullstack auf render gehostetet booktracker webapp auf github in der readme is geplant was noch alles verbessert werden soll und du sollst auch noch mal gukcen was überarbeitet werden kann und was noch fehlt eventuel was nnoch nicht so topp ist etc und da kannst du gern die verbesserungs liste ergeänzen und auch gleich alles verbessern, wichtig in der suche sollenb alle bücher gefunden werden die es gibt und die cover sollen einmal geladen werden und für den user bleiben und nicht immer wieder neu geladen werden etc steht ales in der readme, außerdem funktioniert das cover auffrischen nicht so gut und das reihen automatisch erkennen hab ich noch nicht probieret mach ein umfassendes gutes update https://github.com/AntonHeinrich05/BookShelf/tree/conflict_031026_2152“

## Bestätigte Entscheidungen
- Mehrere Buchkataloge, möglichst schnelle Suche, **alle deutschen Bücher so gut wie möglich**.
- „Cover auffrischen“ kann weg: Es war nur als erfolgloser Notbehelf bei fehlendem Cover gedacht.
- Bestehende App statt Neubau; README-Roadmap abarbeiten und sinnvoll ergänzen.

## Personas / unveränderliche Anforderungen
- Private Leser:innen pflegen eigene Bibliothek/Wunschliste, Fortschritt, Reihen und Kalender, oft auf iPhone/iPad.
- Vorhandene Nutzer:innen dürfen keine Bücher, Cover, eigenen Zuordnungen oder Lesezeit verlieren.
- Privates Konto, German-first UI/Suche, bestehender Dark/Light-iOS-Stil und PWA-Verhalten.
- Dauerhafte Cover, manuelle Ergänzung bei fehlenden Katalogdaten, kein Anspruch auf unmögliche vollständige Weltkatalog-Abdeckung.

## Architekturentscheidungen
- Originalbranch nach `/app` übernommen. React 18/CRA/craco, FastAPI, Motor/MongoDB weiterverwendet. Kein Expo, kein Framework-Neubau.
- Original `design_guidelines.json` beibehalten. Vorhandene API ohne `limit` kompatibel; neue Listen verwenden Seitenergebnisse.
- Cover als separate MongoDB-Binaries <=150KB, <=400x600; relative geschützte Pfade. Eigene Uploads immutable gegenüber Auto-Suche. Browser Cache API pro Konto, keine Tokens in URLs. Such-Thumbnails separate kurzlebige Collection.
- Quellen Google Books, Open Library, DNB behalten; parallele begrenzte Suchabfragen, TTL-Cache und ISBN-Deduplizierung. Keine kostenpflichtige neue Integration. Keine Fake-Katalogdaten.
- Geschützte Vorschau-Umgebung unverändert: vorhandene MONGO_URL und REACT_APP_BACKEND_URL; APP_ORIGIN zusätzlich für explizites CORS. Produktive Daten/Render/GitHub-Branch wurden nicht verändert.
- Live Google-Anmeldung ist mangels GOOGLE_CLIENT_ID in der Vorschau nicht prüfbar; Google Books liefert hier teils Kontingentfehler. Deutsche Suche funktioniert über echte DNB-Antworten.

## Implementiert – 03.10.2026 / Update 3.0
- Original README-Punkte 1–10 bearbeitet: dauerhafte Cover, DNB-Proxy/Fallback, eigener geschützter Upload, volle PWA-Höhe, kompakter Scroll-Header, Statistik-Auswahlbutton, flüssiger/tastaturbedienbarer Timer-Kreis, Google-Button-Theme, Besitz-Automatik, echte Pagination.
- Echte deutsche Katalogsuche mit Quellenstatus, mehrseitiger DNB-Abfrage, ISBN-10/13-Abgleich, Abbruch überholter Browseranfragen; bestehender Treffer öffnet eigenes Buch.
- Konservative Reihen-Erkennung (keine Zahlenheuristik, genauere Titel/Autor-Treffer, keine Verlagsreihen); Parserkorrektur „Meine Reihe“ bleibt vollständig.
- CSV-Feld-Roundtrip erweitert, JSON-Listenfelder, Semikolon/Tab-Erkennung, Import-Namenscache gegen quadratische Datenbankabfragen, Genrezuordnungen erhalten.
- Private Caches/Timer bei Abmeldung getrennt und geleert; Beschreibung ohne fremdes HTML; Eingabe-/Uploadvalidierung; Kennwortkompatibilität und Anmelderatenbegrenzung.
- Delta-Buchupdates statt vollständiger Ersetzung, idempotente Timersessions, historische Zeit bleibt bei Sessionänderung erhalten, Prozentfortschritt ohne Seitenzahl, historische Zeiten in Statistik.
- Bibliotheks-Gruppenzähler passen zum Ausschluss der Wunschliste; stabile Sortierung, Indizes, Job-Unterbrechungsanzeige.
- README komplett aktualisiert: erledigte Punkte, Funktionsgrenzen, Speicher/Backup-Hinweise und ergänzte priorisierte Aufgaben.

## Verifikation
- Build und compileall erfolgreich. Erstprüfung 16/17 API-Tests; Reihenfehler behoben. Danach **17/17 bestanden**, `test_reports/pytest/retest_results.xml`.
- Desktop/Mobil-UI für Login, Suche, CRUD, Statistik, Isolation geprüft; Screenshots im Testreport.
- Echter DNB-Suchtreffer „10 Blind Dates für die große Liebe“ und dauerhaft gespeichertes JPEG 379x599 / 41646Bytes bestätigt; Folgeabruf ~0,12s.
- Vertiefte Prüfung `test_reports/iteration_2.json`: 8/8 zusätzliche Tests erfolgreich (CSV-Roundtrip, 160-Zeilen-Normalisierung, Genrezuordnung, dauerhafte Cover, ETag, Cache, Custom-Schutz, Proxygrenzen, Gruppenzahlen).
- Abschließend **25/25** in sauberer eigener Paketumgebung bestanden; Backend-Manifest enthält nur tatsächlich benötigte Abhängigkeiten (42 inkl. transitiver Pakete) statt kompletter Werkzeugumgebung. `test_reports/pytest/final_results.xml`.
- Kleinen UI-Befund behoben: bei 4xx keine unnötigen Query-Wiederholungen mehr. Im Browser sofortiger 404-Leerzustand bestätigt.
- Prozent-Timer ohne Seitenzahl im Browser per Tastatur+Eingabe auf 63% gesetzt und gespeichert, bestätigt. Echtes Cover in `test_reports/final-book-detail.jpg`, mobile/tablet Cover-Screenshots ebenfalls im Reportverzeichnis.
- Testbild ins Repository unter `backend/tests/fixtures/dnb-cover.jpg` übernommen; Regressionstests benötigen keine vorher vorhandenen Nutzer-/Buch-IDs oder /root-Dateien mehr.
- Reales iOS-Standalone und Google-Login benötigen weiterhin Originalkonfiguration/Gerät. Google-Bücherquelle in Vorschau teils nicht verfügbar; DNB-Suche real geprüft.

## Priorisierter Backlog / nächste Aufgaben
### P0
- Produktive MongoDB inkl. covers sichern; bestehende DB/Umgebung beibehalten. Kein Anspruch, dass CSV Bilddaten oder Sessionhistorie vollständig sichert.
### P1
- Portabler vollständiger Backup/Restore mit Coverdateien und Sessions.
- Bestätigbare Reihen-Vorschläge + Änderungsverlauf; neustartfeste Mehrprozess-Jobwarteschlange.
- Optional GOOGLE_BOOKS_API_KEY, vorhandene GOOGLE_CLIENT_ID für echte Login-Prüfung.
- Reales iPad/iPhone-Standalone, HEIC-Unterstützung; große Bibliotheken >20.000 und Volltextsuche/Aggregationen.
- Passwort vergessen / Mail-Verifizierung / Sitzungsverwaltung.
### P2
- Jahresleseziel, Streak, Reihenlücken auf Wunschliste, getrennte Lesedurchgänge.
- Vollständige Offline-App; Quellendrosselung/Circuit-Breaker bei vielen Konten, Cache-/Bildversionsbereinigung, weitere Barrierefreiheit.

## Historie vor diesem Update
Vorhandene Iteration 4 brachte Mehrquellensuche, Statistik-Zeiträume, Reihen-Erkennung, Import-Jobs, Timer/Wake-Lock, Kalender-Cover und Bibliotheksfilter. Dieser Stand stammt aus dem Nutzerbranch; er wurde nicht als Neuentwicklung ausgegeben.