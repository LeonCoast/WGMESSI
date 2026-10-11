/* ===================== EINSTELLUNGEN =====================
   1) Hier die Firebase-Konfiguration einfügen (aus der Firebase-Konsole kopieren).
   2) WG_ID und NTFY_TOPIC NICHT ändern – die stehen auch in der Anleitung.     */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyATpgnMaIGlMhmJVfZSnOWwQENa7yIg21M",
  authDomain: "wg-vorrat.firebaseapp.com",
  projectId: "wg-vorrat",
  storageBucket: "wg-vorrat.firebasestorage.app",
  messagingSenderId: "1032028316979",
  appId: "1:1032028316979:web:ef5c6b793304da96e04a46"
};
const WG_ID = "wg-df6970f8e70a3ab3";
const NTFY_TOPIC = "wgvorrat-c54d95de25513d322851";
/* Passwort als SHA-256-Fingerabdruck (nicht im Klartext). Aktuell: das WG-Passwort */
const PASS_HASH = "9bcdae8ebc2a970a365103a52da830f3958f4f381fcfd544f7c0452ee09dba00";
/* Lokaler Testmodus: auf localhost keine echte Datenbank und keine Push-Nachrichten */
const LOCAL_DEV = ["localhost","127.0.0.1",""].includes(location.hostname);
/* ========================================================= */
