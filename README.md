# Stempelkorrektur – Handy-App

Ersetzt das Papierformular «Stempelkorrekturen – Antrag an Vorgesetzte/n». Pro Woche und Person
Von/Bis, Pause und Grund eintragen und alles zusammen als übersichtliches PDF ans Büro mailen.

Begonnen am 28.09.2026, PDF-Versand seit 29.09.2026.

## So funktioniert sie

- **Woche:** Beim Öffnen zeigt die App am Montag automatisch die *letzte* Woche (da wird
  nachgetragen), an allen anderen Tagen die laufende. Mit ‹ › blätterst du.
- **Personen:** Oben die Reiter, einer pro Person (du zuerst, dann die Mitarbeitenden). Unter dem
  Namen steht das Wochentotal, ein Häkchen heisst «schon gesendet».
- **Eintragen:** Tag antippen → Von/Bis (die Handy-Zeitauswahl), Pause und Grund antippen,
  Speichern. Die App schlägt immer die Werte vom letzten Eintrag vor.
- **Gilt für:** Im Eintrag weitere Personen antippen, dann wird derselbe Eintrag für alle
  gespeichert. Die Auswahl bleibt für den nächsten Tag stehen (praktisch, wenn das Team zusammen
  unterwegs war).
- **Über Mitternacht:** Ist «Bis» früher als «Von», endet die Arbeit am Folgetag
  (z. B. 23:00–04:00).
- **Nachtzuschlag:** Standard 22:00–05:00 mit 25 % Zuschlag, einstellbar. Die Pause wird anteilig
  von Tag- und Nachtzeit abgezogen. Anzeige: «5:00 h (+1:15 h Nachtzuschlag)».
- **Senden:** Unten «KW … per Mail senden» → Personen wählen → «PDF per Mail senden».
  - **Das PDF** hat eine A4-Seite pro Person, aufgebaut wie das Papierformular: Kopf mit KW,
    Mitarbeiter/in und Vorgesetzte/r, alle 7 Tage mit Von, Bis, Pause, Grund, Stunden,
    Nachtzuschlag, darunter das Wochentotal. «PDF ansehen» zeigt es vorher an.
  - **Auf dem Handy** öffnet sich «Teilen»: «Mail» oder «Outlook» wählen, das PDF ist angehängt,
    Betreff und ein kurzer Text mit den Wochentotalen stehen drin. Den Empfänger tippt man an
    (die Mail-App schlägt ihn nach dem ersten Mal selbst vor).
  - **Am PC** wird das PDF im Download-Ordner gespeichert und die Mail öffnet sich mit Empfänger,
    Betreff und Text. Das PDF zieht man dann in die Mail.
  - **Ohne PDF:** Unter «Lieber ohne PDF, nur als Text-Mail» gibt es die alte Text-Mail mit
    allen Zeiten im Text.
- **Status:** Nach dem Senden steht «Mail erstellt am …». Wird danach noch etwas geändert,
  erscheint «Nach dem Senden geändert – bitte nochmals senden». Beim nächsten Senden sind dann
  nur die geänderten Personen vorausgewählt.

Warum der Empfänger beim PDF nicht schon eingetragen ist: Ein vorausgefüllter Mail-Link
(`mailto:`) kann keine Anhänge mitgeben. Das PDF muss darum über «Teilen» bzw. den
Download-Ordner in die Mail. Ein Versand mit *einem* Tipp ginge nur über einen eigenen Server
(siehe «Mögliche Ausbauten»).

## Wo die Daten liegen

Nur auf dem Handy, im Speicher des Browsers (`localStorage`). Es gibt keinen Server und kein Konto.
Auch das PDF entsteht direkt auf dem Gerät. Die Daten verlassen es erst mit der Mail. Einträge
älter als 400 Tage werden beim Start entfernt. Wird der Browser-Speicher gelöscht, sind
Einstellungen und Einträge weg. Dann einfach neu einrichten, gesendete Wochen liegen ja im
Postausgang.

## Aufs Handy bringen (iPhone)

1. Die Adresse der App in **Safari** öffnen.
2. Teilen-Knopf → «Zum Home-Bildschirm».
3. Ab dann über das Symbol starten. Die App läuft dann ohne Browserleiste und auch ohne Empfang.

(Android/Chrome: Menü ⋮ → «App installieren» bzw. «Zum Startbildschirm hinzufügen».)

## Dateien

| Datei | Aufgabe |
|---|---|
| `index.html` | Aufbau: Kopf, Tage, Senden-Knopf und die drei Blätter (Eintrag, Senden, Einstellungen) |
| `css/style.css` | Aussehen, hell und dunkel (folgt der Handy-Einstellung) |
| `js/app.js` | Oberfläche: zeichnen, auf Antippen reagieren, Senden (Teilen bzw. Download + Mail) |
| `js/zeit.js` | Datum, Kalenderwoche (ISO), Stunden- und Nachtrechnung, ohne Bildschirm und darum testbar |
| `js/speicher.js` | Speichern/Laden im Handy; nur diese Datei kennt das Speicherformat |
| `js/mail.js` | Betreff, Begleittext zum PDF, Text-Mail und `mailto:`-Link |
| `js/pdf.js` | Schreibt PDF-Dateien ohne fremde Bibliothek (Helvetica, Linien, Flächen, Umlaute) |
| `js/blatt.js` | Gestaltet das Stempel-Blatt: eine A4-Seite pro Person |
| `sw.js` | «Service Worker»: legt die App-Dateien auf dem Handy ab, damit sie offline startet |
| `manifest.webmanifest`, `icons/` | Name und Symbol für den Home-Bildschirm |
| `tests/zeit.test.mjs` | 13 Rechentests |
| `tests/pdf.test.mjs` | 4 PDF-Tests (gültiger Aufbau, Umlaute, Breiten, Dateiname); legt `tests/ausgabe/probe.pdf` ab |
| `tests/ablauf.mjs`, `tests/cdp.mjs` | Spielt die ganze App in einem unsichtbaren Edge in Handygrösse durch |

Die `js`-Dateien sind bewusst **normale Skripte, keine «Module»**. Module blockiert der Browser,
wenn man `index.html` per Doppelklick öffnet (Adresse beginnt dann mit `file:///`). Jede Datei
stellt ihre Funktionen unter einem Namen bereit (`Zeit`, `Speicher`, `Mail`, `PDF`, `Blatt`), und
`index.html` lädt sie in dieser Reihenfolge.

Die Zeichenbreiten in `js/pdf.js` sind an Arial gemessen. Arial ist genau so breit wie
Helvetica (a = 556, Leerschlag = 278 …). Damit stehen rechtsbündige Zahlen im PDF richtig.

## Am PC öffnen und testen

- **Einfach:** `index.html` doppelklicken. Alles funktioniert, nur der Offline-Teil (Service
  Worker) nicht, der braucht eine echte Webadresse.
- **Wie später online**, mit Offline-Teil:
  ```
  python -m http.server 5181 --bind 127.0.0.1
  ```
  Dann `http://localhost:5181` öffnen.

Tests:
```
npm test
node tests/ablauf.mjs http://localhost:5181/ shots
node tests/ablauf.mjs file:///C:/Pfad/zum/Projekt/index.html shots
```
Der Ablauftest legt das erzeugte PDF als `shots/woche.pdf` ab, zum Anschauen einfach öffnen.

**Nach Änderungen an Dateien** in `sw.js` die `VERSION` um eins erhöhen (`stempel-v4` …), damit
die Handys die neue Fassung sicher übernehmen.

**Zwei Kopien:** Gearbeitet wird im lokalen Projektordner. Eine Kopie liegt im Geschäfts-OneDrive
(Ordner `stempelkorrektur`). Nach Änderungen dorthin nachkopieren. Aufs Handy bringt OneDrive die App nicht: Die OneDrive-App zeigt
`index.html` nur als Vorschau an, ohne dass die App läuft. Dafür braucht es eine Webadresse
(Hosting).

## Verifikationsstand (29.09.2026)

Geprüft:
- `npm test`: 17/17 grün. Davon 13 Rechentests (normaler Tag, 23–04 Uhr = 5:00 h +1:15 h, Abend
  in die Nacht, früher Morgen, Pause anteilig, lange Schicht, eigenes Nachtfenster, Eingabefehler,
  Kalenderwochen inkl. Jahreswechsel und Sommerzeit, Startwoche) und 4 PDF-Tests (jedes Objekt
  steht an der Stelle, die das Verzeichnis nennt, Längenangaben stimmen, reines ASCII, ä/ü/«–»/
  Klammern richtig kodiert, Kürzen mit «…», Dateiname).
- `tests/ablauf.mjs` in Edge headless mit 390 × 844 px über `http://localhost`: 38/38 grün.
  Geprüft werden Einrichtung, Team-Eintrag für 4 Personen, Nachteintrag, Fehlermeldung,
  Wochentotal, kein seitliches Scrollen, Senden-Blatt (Übersicht, Hinweis), Text-Mail-Link,
  «PDF ansehen» (gültiges PDF mit 4 Seiten), PC-Weg (PDF-Download mit richtigem Namen, danach
  mailto mit Empfänger, Betreff, Begleittext), Status, Warnung nach Änderung, Handy-Weg (iPhone
  vorgetäuscht: PDF wird mit Betreff und Text an «Teilen» übergeben, nur geänderte Person
  vorausgewählt), Wochenwechsel, dunkles Design, Service Worker, Start **offline**, keine
  Konsolenfehler.
- Derselbe Ablauf per `file:///…/index.html` (wie Doppelklick): 35/35 grün (ohne die 3
  Offline-Prüfungen).
- Das von der App erzeugte PDF im PDF-Programm von Edge angesehen: 4 Seiten, Umlaute, Spalten
  und Totale korrekt.

Noch nicht geprüft (braucht ein echtes Handy):
- Das «Teilen»-Fenster auf dem iPhone: ob «Mail»/«Outlook» das PDF anhängt und Betreff und Text
  übernimmt. Im Test wurde das Teilen nur nachgebildet.
- «PDF ansehen» auf dem iPhone, besonders wenn die App vom Home-Bildschirm gestartet ist.
- Zeitauswahl, Tastatur und «Zum Home-Bildschirm» auf dem echten Gerät.
- Am Firmen-PC: ob Outlook beim Mail-Link aufgeht (hängt davon ab, welches Mailprogramm in Windows
  eingestellt ist).

## Mögliche Ausbauten

- Echter Ein-Klick-Versand mit PDF, ohne Mail-App: braucht einen kleinen Server (z. B. PHP beim
  Webhoster) mit Mail-Zugang. Dann nur den Senden-Knopf in `js/app.js` anpassen, das PDF kommt
  weiter aus `js/blatt.js`.
