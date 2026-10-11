# WG Vorrat

Web-App für die WG von Leon, Lucio und Yannick: Vorräte, Einkaufsliste, Ausgaben, Kalender, To-dos, Chat.
Installierbar als Home-Screen-App (PWA-Manifest), komplett auf Deutsch.

## Pflege dieser Datei

**Bei jedem Commit diese Datei mit dem aktuellen Stand aktualisieren** (neue Features, Datenmodell, Konventionen,
Stolperfallen) und im selben Commit mitschicken. Kurz halten, nur was man nicht schnell aus dem Code liest.

## Aufbau

Statische Seite ohne Build, ohne Framework, ohne npm. GitHub Pages liefert die Dateien direkt aus.

```
index.html          HTML-Gerüst + <script>-Tags (Reihenfolge ist wichtig, s. u.)
manifest.json       PWA-Manifest
css/app.css         alle Styles (Farben als Tokens auf :root, Dark Mode per prefers-color-scheme)
js/config.js        Firebase-Config, WG_ID, NTFY_TOPIC, PASS_HASH, LOCAL_DEV
js/util.js          Konstanten (PEOPLE, CATS, …) und Helfer ($, esc, ls, eur, ago, isoDay, toNum, avatar)
js/fx.js            Sprüche, Sounds (Web Audio + assets/kauf.mp3), Konfetti, Toast
js/store.js         state, me, Store (Firestore oder localStorage-Fallback)
js/push.js          ntfy-Push + Push-Einstellungsdialog
js/ui.js            openModal/closeModal, pickMe
js/chat.js          Chat-Logik + Pop-up
js/muell.js         Müll-Status
js/vorrat.js        Vorrat, Einkaufsliste, Kaufen, Artikel bearbeiten, Willkommens-Popup
js/kalender.js      Abwesenheiten
js/receipt.js       Kassenbon-Scan (Tesseract)
js/geld.js          Ausgaben, Bilanz (money()), Ausgleich
js/home.js          Home-Reiter, eigene To-dos, automatische To-dos
js/main.js          render(), bindView(), Tab-Leiste, Passwort-Gate, App-Start — muss als letztes laden
assets/icons/       App-Icons, assets/kauf.mp3 = Kauf-Sound
```

- Die JS-Dateien sind **klassische Skripte, keine Module**: Alle teilen sich den globalen Scope, top-level `const`/`let`
  sind dateiübergreifend sichtbar. Funktionen dürfen sich gegenseitig beliebig aufrufen, aber **Code, der beim Laden
  sofort läuft**, darf nur auf Dateien zugreifen, die vorher geladen wurden. Startcode gehört nach `main.js`.
- Neue Datei → `<script src>` in `index.html` vor `main.js` eintragen.
- Externe Skripte nur per CDN: Firebase compat SDK 10.12.2 (gstatic), Tesseract.js 5.1.1 (jsDelivr, lazy beim Bon-Scan).
- Rendering: `render()` baut `#view` per Template-Strings neu, `bindView()` hängt danach die Handler über
  `data-*`-Attribute an. Modale Dialoge über `openModal(html)` / `closeModal()`. Nutzertext immer mit `esc()`.
- Der Chat ist **kein Reiter**, sondern ein festes Pop-up (`#chatPanel`, `#chatFab`), einmalig gebunden in `bindChat()`.

## Reiter

`home` (Start: To-dos „Für dich“ / „WG“ + Überblickskarten) · `vorrat` (Kacheln, Status Voll → Fast leer → Leer, Müll-Anzeige)
· `liste` (Einkaufsliste) · `geld` (Ausgaben, Bilanz, „So werdet ihr quitt“) · `kalender` (Abwesenheiten).

## Daten (Firestore, Projekt `wg-vorrat`, Spark-Plan)

Alles unter `wgs/{WG_ID}/…`. Die Regeln erlauben read/write auf `wgs/{wgId}/{document=**}` für genau diese WG-ID,
neue Sammlungen brauchen also keine Regeländerung.

| Sammlung | Inhalt |
|---|---|
| `items` | Vorrat: `name, emoji, cat, status (full/low/empty), order, by, at, boughtBy?` |
| `purchases` | Einkäufe: `item, itemId?, emoji, who, price, at, store?, receiptId?, label?`; Ausgleich: `kind:"settle", who (zahlt), to` |
| `receipts` | Kassenbons: Metadaten + Foto als JPEG-Data-URL (Graustufen, < ~150 KB). Nur bei Bedarf geladen |
| `chat` | Nachrichten, ID = Zeitstempel + uid, es werden die letzten 300 geladen |
| `away` | Abwesenheiten: `who, from, to (YYYY-MM-DD), note` |
| `bins` | Müll: Doc-ID `rest`/`papier`, `status (full/ok), by, at` |
| `todos` | Eigene To-dos: `text, who ("" = WG), done, doneBy, doneAt, by, at` |
| `prefs` | Push-Einstellungen pro Person (Doc-ID = Name) |

Geld-Logik steckt in `money()`: Einkäufe werden gedrittelt, `settle`-Einträge verschieben nur zwischen zwei Personen
und zählen nicht als Einkauf (Wertung „Wer kauft ein?“). Die Wertung und der Einkaufs-Vorschlag auf Home zählen
**Artikel, nicht Einkäufe**: Ein Bon mit 5 Zeilen zählt 5×. Das ist so gewollt, nicht „reparieren“. Automatische To-dos (`autoTodos()`) werden nicht gespeichert,
sondern jedes Mal aus dem Stand berechnet.

## Push

Über ntfy.sh, ein Thema pro Person (`pushTopic(name)`). `sendPush(ev, title, msg, tags, only?)` respektiert die Prefs
(`PUSH_EVENTS`) und schickt nie an einen selbst. Status-Meldungen gehen verzögert raus (`notifyLater`, 20 s), damit
Vertipper nicht pushen.

## Lokal entwickeln

```
python3 -m http.server 8000   # im Repo, dann http://localhost:8000
```

Auf `localhost` / `127.0.0.1` / `file:` ist `LOCAL_DEV` aktiv: **kein Firebase, keine Pushes**, Daten nur im
localStorage (`wg_local`, Bons in `wg_receipts`). Live-Daten werden also nie aus Versehen geändert.

## Deploy

GitHub Pages aus `main` (Repo `LeonCoast/WGMESSI`) → https://leoncoast.github.io/WGMESSI/.
**Jeder Push auf `main` ist sofort live** (~30–60 s). Feature-Arbeit auf Branches (z. B. `dev/features`), Leon und Lucio
arbeiten parallel an derselben `index.html`, also vor dem Mergen `origin/main` holen.

## Stolperfallen

- Firebase-Config, WG-ID und ntfy-Thema stehen öffentlich im Quellcode. Das Passwort-Gate (SHA-256 im Browser) hält nur
  Gelegenheitsbesucher fern, echten Schutz gibt es nicht.
- Bon-Scan nutzt Tesseract im Browser: Vorverarbeitung = Graustufen → Geraderücken (`deskew`) → Hochskalieren, PSM 4,
  Fallback mit Binarisierung. Liefert bei echten Fotos einen Entwurf mit Fehlern, darum gibt es immer den Prüf-Dialog
  (mit „Erkannter Text“ zum Debuggen). Bon-Wörter → Vorrat-Artikel über `ALIAS`.
- iOS: Eingabefelder brauchen ≥ 16 px Schrift, sonst zoomt Safari.
- GitHub Pages cacht Dateien ca. 10 Minuten. Direkt nach einem Deploy kann ein Gerät kurz eine Mischung aus alter und
  neuer Version laden; im Zweifel App schließen und neu öffnen.
