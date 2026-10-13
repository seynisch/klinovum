# Ausfall-Rechner: Link geöffnet → Attio

Wenn ein Lead den persönlichen Rechner-Link öffnet, wird das im CRM vermerkt.

## So funktioniert es

1. Der Link enthält eine Kennung des Leads:
   `https://klinovum.de/ausfallrechner/?haus=NAME&plaetze=ANZAHL&lid=ATTIO_PERSONEN_ID`
   oder statt `lid` die E-Mail-Adresse: `...&e=name@firma.de`.
   Immer mit Schrägstrich nach `ausfallrechner` verlinken.
2. **nginx auf klinovum.de** spiegelt jeden Aufruf von `/ausfallrechner/` im Hintergrund an einen
   geheimen n8n-Webhook (`mirror`). Die Seite selbst wird dadurch nicht verändert oder verlangsamt, es gibt
   kein zusätzliches JavaScript und keinen Cookie. Schablone: `nginx_snippet.conf`
   (Platzhalter `__RECHNER_WEBHOOK_PFAD__` und `__RECHNER_GEHEIMNIS__` stehen nur auf dem Server).
3. **n8n-Workflow** "Klinovum: Ausfall-Rechner Link geöffnet → Attio" (ID `wrSjUFXrJA1TAjvC`, Export in
   `workflow_link_geoeffnet.json`, ohne Geheimnisse):
   - prüft das Geheimnis aus dem Header `X-Klinovum-Secret`,
   - zählt nur echte Browser-Aufrufe (`Sec-Fetch-Dest: document`), verwirft Bots, Skripte und Link-Scanner,
   - unterdrückt Wiederholungen: ein Vermerk je Person und sechs Stunden,
   - findet die Person per `lid` (Attio-Record-ID) oder legt sie per `e` (E-Mail) an,
   - legt die Notiz **"Ausfall-Rechner geöffnet"** an (Zeit, Haus und Plätze laut Link) und setzt
     **Letzte Aktivität** auf heute.
4. Zugang zu Attio über das n8n-Credential "Attio (Klinovum Vertriebsautopilot)", beschränkt auf `api.attio.com`.

Es wird bewusst keine Phase geändert und kein "Nächster Schritt" überschrieben.

## Was der Vermerk bedeutet

Die Seite wurde geöffnet. Ob der Rechner ausgefüllt wurde, wissen wir nicht: Die Eingaben bleiben im Browser.

## Stand 13.10.2026

- n8n-Workflow: angelegt, aktiv, isoliert getestet (Erfolg, Duplikat, falsches Geheimnis, Skript, Bot, ungültige Kennung).
- nginx auf klinovum.de: Konfiguration in `/opt/klinovum/nginx.conf` geschrieben und mit `nginx -t` geprüft,
  **aber noch nicht neu geladen**. Aktivieren: `docker exec klinovum-klinovum-1 nginx -s reload`.
  Danach einmal End-to-End testen (Test-Person anlegen, Link mit `lid` per Browser-Header aufrufen, Notiz prüfen, Test-Person löschen).
- Sicherungen auf dem Server: `/opt/klinovum/nginx.conf.bak-20261013-152158`,
  `/opt/klinovum/backup-index-20261013-before-rechner.html`.

## Abschalten

- Workflow in n8n deaktivieren, oder
- die Blöcke `location = /ausfallrechner/index.html` und `location = /_rechner_open` aus der nginx-Konfiguration
  entfernen und nginx neu laden.

## Datenschutz

Der Aufruf mit Kennung wird serverseitig verarbeitet und kann in den Zugriffsprotokollen von Traefik/nginx stehen.
Die Datenschutzerklärung sollte das Vermerken geöffneter persönlicher Links im CRM abdecken. Das ist eine
rechtliche Entscheidung und ist hier nicht geprüft.

## Grenzen

- Link-Scanner einzelner Firmen können Seiten vorab abrufen. Browser-Kennung und Bot-Filter fangen die meisten ab,
  aber nicht alle.
- Wer den Link weiterleitet (zum Beispiel an den Träger), wird dem ursprünglichen Lead zugeordnet.
