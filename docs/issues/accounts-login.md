# Issue: Eigene Accounts mit Login statt gemeinsamem Passwort

**Status:** offen · **Zuständig:** Leon (hat den Firebase-Zugang) · **Angelegt:** 11.10.2026 von Lucio

## Problem

Unsere Daten sind gerade praktisch öffentlich. WG-ID und Firebase-Config stehen im Quellcode (Repo ist öffentlich), und
die Firestore-Regel prüft nur die WG-ID:

```
allow read, write: if wgId == "wg-df6970f8e70a3ab3";
```

Wer den Code liest, kann also Chat, Ausgaben, Kalender, To-dos und Bon-Fotos lesen und ändern. Das WG-Passwort wird nur
im Browser geprüft und lässt sich umgehen. Außerdem kann sich jeder per „Wer bist du?“ als jemand anderes ausgeben.

## Vorschlag

**Firebase Authentication mit E-Mail + Passwort**, ein Account pro Person.

- Im kostenlosen Spark-Plan enthalten, keine Kreditkarte nötig. (Bitte beim Aktivieren in der Konsole kurz gegenchecken.)
- Nur Leon braucht die Firebase-Konsole. Lucio und Yannick bekommen einfach Zugangsdaten für die App, sie brauchen kein
  Google- oder Firebase-Konto. Die E-Mail muss nicht echt sein (`yannick@wg.local` geht), dann funktioniert aber
  „Passwort vergessen“ nicht und Leon setzt das Passwort in der Konsole neu.
- Keine Registrierung in der App: Die drei Accounts werden einmal in der Konsole angelegt.
- Keine Datenmigration: Die App ordnet jeder UID einen Namen zu, alle Einträge mit `who: "Leon"` usw. passen weiter.
  Push-Themen und Push-Einstellungen bleiben gleich.

Bewusst **nicht**: Google-Login (in der iPhone-Home-Screen-App unzuverlässig), SMS-Login (kostet Geld), Passkeys (braucht
eigenen Server).

## Umsetzung

### 1. Firebase-Konsole (Leon)

1. Authentication → Sign-in method → **E-Mail/Passwort** aktivieren.
2. Authentication → Users → drei Benutzer anlegen, Startpasswörter vergeben.
3. Die drei **UIDs** notieren (stehen in der Benutzerliste).

### 2. Code

- `index.html`: Auth-SDK in derselben Version wie die anderen dazuladen, vor `js/config.js`:
  `<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>`
- `js/config.js`: `PASS_HASH` raus, dafür die Zuordnung rein, z. B.
  `const MEMBERS = { "<uid-leon>": "Leon", "<uid-lucio>": "Lucio", "<uid-yannick>": "Yannick" };`
- `js/main.js`: `gate()` durch einen Login ersetzen. Formular mit E-Mail + Passwort →
  `firebase.auth().signInWithEmailAndPassword()`; `firebase.auth().onAuthStateChanged(user => …)` setzt
  `me = MEMBERS[user.uid]` und ruft `start()` auf. Login bleibt pro Gerät gespeichert (Standard-Persistenz).
  Achtung: `firebase.initializeApp()` passiert aktuell erst in `Store.init()` (`js/store.js`) und muss für den Login vorher
  laufen.
- „Wer bist du?“ (`pickMe()` in `js/ui.js`, Knopf `#meBtn`) wird überflüssig: `me` kommt aus dem Login. Der Knopf kann
  stattdessen Name + „Abmelden“ zeigen (`firebase.auth().signOut()`).
- Fehlermeldungen beim Login auf Deutsch (falsches Passwort, kein Netz).
- **Lokaler Testmodus** (`LOCAL_DEV`, localhost) soll ohne Login weiter funktionieren: dort Login überspringen und den
  bisherigen „Wer bist du?“-Dialog behalten.
- `CLAUDE.md` aktualisieren (Login, `MEMBERS`, neue Regel, Stolperfallen-Abschnitt anpassen).

### 3. Firestore-Regel verschärfen

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /wgs/{wgId}/{document=**} {
      allow read, write: if wgId == "wg-df6970f8e70a3ab3"
        && request.auth != null
        && request.auth.uid in ["<uid-leon>", "<uid-lucio>", "<uid-yannick>"];
    }
  }
}
```

## Reihenfolge beim Ausrollen (wichtig)

Sonst ist die Live-App zwischendurch kaputt:

1. Auth aktivieren und Accounts anlegen (Konsole). Das ändert noch nichts an der App.
2. Neuen Code nach `main` pushen. Mit der alten Regel funktioniert alles weiter.
3. Alle drei melden sich auf ihren Handys an, **in der installierten Home-Screen-App**. Die hat auf dem iPhone einen
   eigenen Speicher, ein Login in Safari zählt dort nicht.
4. **Erst dann** die Firestore-Regel aus Schritt 3 veröffentlichen.
5. Prüfen: Die App funktioniert eingeloggt, und ohne Login kommt man nicht an die Daten.

Klappt nach Schritt 4 etwas nicht, lässt sich die alte Regel in der Konsole unter Regeln → Verlauf mit einem Klick
wiederherstellen.

## Fertig, wenn

- [ ] Jeder hat einen eigenen Login, „Wer bist du?“ gibt es live nicht mehr
- [ ] Firestore-Regel lässt nur die drei UIDs zu
- [ ] Lokaler Testmodus funktioniert weiter ohne Login
- [ ] CLAUDE.md beschreibt den neuen Stand
