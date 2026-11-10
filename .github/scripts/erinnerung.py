"""Tägliche Erinnerung um 15 Uhr: Was im Vorrat leer ist und welcher Müll voll ist.
Läuft per GitHub Actions (.github/workflows/erinnerung.yml), liest Firestore über REST und pusht über ntfy.
Werte wie in js/config.js. Aufruf mit --dry-run zeigt nur an, was verschickt würde."""
import json, sys, time, urllib.request, urllib.parse
from datetime import datetime
from zoneinfo import ZoneInfo

API_KEY = "AIzaSyATpgnMaIGlMhmJVfZSnOWwQENa7yIg21M"
WG_ID = "wg-df6970f8e70a3ab3"
NTFY_TOPIC = "wgvorrat-c54d95de25513d322851"
PEOPLE = ["Leon", "Lucio", "Yannick"]
BINS = [("rest", "Restmüll"), ("papier", "Papiermüll")]  # Doc-IDs wie in js/muell.js
BASE = f"https://firestore.googleapis.com/v1/projects/wg-vorrat/databases/(default)/documents/wgs/{WG_ID}/"
MIN_AGE_MS = 24 * 3600 * 1000  # erst erinnern, wenn es schon mindestens einen Tag rot ist

def val(v):
    t, x = next(iter(v.items()))
    if t == "integerValue": return int(x)
    if t == "doubleValue": return float(x)
    if t == "booleanValue": return x
    if t == "mapValue": return {k: val(w) for k, w in x.get("fields", {}).items()}
    if t == "arrayValue": return [val(w) for w in x.get("values", [])]
    return x

def coll(name):
    out, tok = [], None
    while True:
        q = {"key": API_KEY, "pageSize": 300}
        if tok: q["pageToken"] = tok
        d = json.load(urllib.request.urlopen(BASE + name + "?" + urllib.parse.urlencode(q)))
        out += [{"id": doc["name"].rsplit("/", 1)[1], **{k: val(w) for k, w in doc.get("fields", {}).items()}} for doc in d.get("documents", [])]
        tok = d.get("nextPageToken")
        if not tok: return out

def main():
    dry = "--dry-run" in sys.argv
    now = datetime.now(ZoneInfo("Europe/Berlin"))
    # Der Zeitplan läuft zweimal (13 und 14 Uhr UTC), gesendet wird nur im Lauf, der gerade 15 Uhr in Berlin ist.
    # Nach dem geplanten Slot entscheiden, nicht nach der Uhrzeit: GitHub startet geplante Läufe oft verspätet.
    slot = next((a.split("=")[1] for a in sys.argv if a.startswith("--slot=")), None)
    if slot is not None:
        want = 15 - int(now.utcoffset().total_seconds() // 3600)
        if int(slot) != want:
            print(f"Slot {slot} Uhr UTC ist gerade nicht 15 Uhr in Berlin, nichts zu tun."); return
    ms = int(time.time() * 1000)
    empty = sorted((i for i in coll("items") if i.get("status") == "empty" and ms - i.get("at", 0) >= MIN_AGE_MS), key=lambda i: i.get("order", 0))
    bins = {b["id"]: b for b in coll("bins")}
    voll = [label for key, label in BINS if bins.get(key, {}).get("status") == "full" and ms - bins[key].get("at", 0) >= MIN_AGE_MS]
    if not empty and not voll:
        print("Alles grün, keine Erinnerung."); return
    lines = []
    if empty: lines.append("Leer: " + ", ".join(f"{i.get('emoji', '')} {i['name']}".strip() for i in empty))
    lines += [f"🗑️ {label} ist voll" for label in voll]
    title, msg = "🔔 Immer noch offen", "\n".join(lines)
    prefs = {p["id"]: p for p in coll("prefs")}
    today = now.strftime("%Y-%m-%d")
    away = {a.get("who") for a in coll("away") if a.get("from", "") <= today <= a.get("to", "")}
    for p in PEOPLE:
        if not prefs.get(p, {}).get("erinnerung", True) or p in away:
            print(f"{p}: übersprungen"); continue
        print(f"{p}: {title} / {msg!r}")
        if not dry:
            body = json.dumps({"topic": f"{NTFY_TOPIC}-{p.lower()}", "title": title, "message": msg, "tags": ["bell"], "priority": 3}).encode()
            urllib.request.urlopen(urllib.request.Request("https://ntfy.sh/", data=body, method="POST"))

main()
