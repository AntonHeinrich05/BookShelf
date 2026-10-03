# Schlussprüfung · 03.10.2026

- 25/25 automatisierte Tests erfolgreich: `pytest/final_results.xml`, ausgeführt in neu installierter `/root/bookshelf-runtime`-Paketumgebung gegen die getrennte Vorschau und ihre MongoDB.
- Produktionsbuild erfolgreich: `/app/build-verification.log`.
- Befund „Meine Reihe“ übermäßig gekürzt: behoben und Regression bestanden.
- Befund verzögerter 404-Leerzustand: 4xx-Retries entfernt, im Browser innerhalb 3-Sekunden-Prüffenster sichtbar.
- Chart-Warnung: gemessene positive Diagrammgröße, zweite UI-Prüfung ohne Warnung.
- Prozent-Timer: Buch ohne Seitenzahl, Tastatur-End auf 100, Eingabe 63, Speichern, Detail zeigt 63%; erfolgreich.
- Echte Buchcover auf Desktop/Mobil/Tablet, Wiederverwendung aus kontogetrenntem Bildcache, Upload-Persistenz und Abmeldebereinigung bestätigt.
- Die Anwendung nutzt echte Dienste; isolierte Unit-Tests verwenden Spies/Fehler-Injektion nur innerhalb des Testprozesses.
- Nicht geprüft/verfügbar: vollständige Google-Anmeldung mangels GOOGLE_CLIENT_ID in der Vorschau; physisches iOS-Standalone-Verhalten. Google Books ist ohne passenden Schlüssel teils nicht verfügbar, andere Kataloge liefern echte Ergebnisse.
- Keine produktiven Daten verändert. CSV überträgt Metadaten, keine vollständige Bild-/Session-Sicherung.