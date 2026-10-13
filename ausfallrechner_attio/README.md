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

- Aktiv und End-to-End getestet über die echte Domain: Aufruf von `klinovum.de/ausfallrechner/?lid=...` mit Browser-Kennung
  legt nach rund zwei Sekunden die Notiz in Attio an. Ohne Kennung, mit Bot-Kennung oder ohne Browser-Header passiert nichts,
  ein zweiter Aufruf innerhalb von sechs Stunden erzeugt keinen zweiten Vermerk. Die Antwortzeit der Seite bleibt bei rund 80 ms.
- n8n-Workflow aktiv. nginx-Konfiguration in `/opt/klinovum/nginx.conf` (nur in-place beschreiben, die Datei ist in den Container gemountet)
  und mit `nginx -s reload` geladen.
- Sicherungen auf dem Server: `/opt/klinovum/nginx.conf.bak-20261013-152158`,
  `/opt/klinovum/backup-index-20261013-before-rechner.html`.
- Noch offen: Ein Prozess, der die Kennung (`lid` oder `e`) in die Links einbaut, die an Leads gehen.

## Kurzlinks statt langer Links

Lange Links mit Parametern wirken wie Phishing. Deshalb gibt es persönliche Kurzlinks:

- Format: `https://klinovum.de/r/k3p9tm` (sechs Zeichen).
- **Erzeugen:** n8n-Formular "Rechner-Link erstellen" (E-Mail der Person, Name des Hauses, Anzahl Plätze). Es legt die Person in Attio
  an, falls es sie noch nicht gibt, erzeugt den Kurzlink und legt ihn als Notiz "Ausfall-Rechner-Link erstellt" an der Person ab.
  Dieselben Angaben ergeben denselben Link. Adresse des Formulars: nur intern, steht nicht im Repo.
- **Auflösen:** nginx auf klinovum.de gibt `/r/<code>` an einen n8n-Webhook weiter. Der leitet auf
  `/ausfallrechner/?haus=...&plaetze=...&lid=...` weiter, nginx spiegelt diesen Aufruf wie oben an den Attio-Vermerk.
  Ein unbekannter Code führt auf `/ausfallrechner/`, fällt n8n aus, ebenfalls.
- **Aufräumen der Adresse:** `app.js` entfernt die Parameter nach dem Laden aus der Adressleiste (`history.replaceState`)
  und merkt Haus und Plätze für die Sitzung, ein Neuladen behält die Vorbelegung.
- Die Zuordnung Kurzcode zu Person liegt in den Workflow-Daten von n8n ("Klinovum: Rechner-Kurzlinks", Export in
  `workflow_kurzlinks.json`, ohne Geheimnisse). Schablone für nginx: `nginx_snippet_kurzlink.conf`.
- Test über die echte Domain am 13.10.2026: Kurzlink erzeugt, mit Browser-Kennung geöffnet, Weiterleitung unter 0,2 s,
  Notiz "Ausfall-Rechner geöffnet" in Attio, Test-Person gelöscht.

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
