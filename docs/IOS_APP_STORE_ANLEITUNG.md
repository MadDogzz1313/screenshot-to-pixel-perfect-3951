# Leonida Explorer als iPhone-App im App Store – Schritt für Schritt (ohne Mac)

Die iPhone-App ist eine **Capacitor-Hülle um deine Live-Website** (`https://leonida-preview-2.emergent.host`).
Web-App und Home-Bildschirm-App (PWA) bleiben **unverändert**. Alle drei nutzen dieselbe Datenbank,
Konten, Fundorte, XP, Abzeichen und Chats gehen also nicht verloren. Änderungen an der Website sind nach dem
Veröffentlichen sofort auch in der iPhone-App sichtbar. Eine neue App-Version (Codemagic) brauchst du nur bei
nativen Änderungen, z. B. bei einem neuen App-Symbol.

| Was | Wo im Projekt |
|---|---|
| App-Einstellungen (Kennung, Name, Live-Adresse) | `capacitor.config.ts` |
| Xcode-Projekt (wird in der Cloud gebaut) | `ios/` |
| Ersatzseite ohne Internet | `ios-shell/index.html` |
| Cloud-Build zu TestFlight | `codemagic.yaml` |
| Apple-Push im Server | `backend/services/apns.py` |
| Datenbank-Update | `docs/migrations/011_ios_app_push_konto_loeschen.sql` |

**App-Kennung (Bundle ID):** `de.leonida.explorer` · **Name auf dem Home-Bildschirm:** Leonida Explorer

---

## Schritt 0 – Vorbereitung (bei Lovable)
1. Falls noch nicht geschehen, zuerst **010** und `select public.push_set_config(...)` ausführen.
2. Danach `docs/migrations/011_ios_app_push_konto_loeschen.sql` im SQL-Editor von Lovable ausführen.
   Ergebnis: `011 erfolgreich eingerichtet | t | t`.
3. Die Website veröffentlichen (Deploy), damit die neue Version mit Apple-Push, „Konto löschen“ und den
   Rechtstexten live ist.
4. In `src/components/LegalPage.tsx` deinen Namen, deine Anschrift und deine Kontakt-E-Mail eintragen
   (`OPERATOR`). Ohne diese Angaben lehnt Apple die App ab, außerdem verlangt die DSGVO sie.

## Schritt 1 – Apple Developer Program (99 €/Jahr)
1. Lade die App **„Apple Developer“** aus dem App Store auf dein iPhone.
2. Tippe auf **Konto → Jetzt registrieren** und melde dich mit deiner Apple-ID an (Zwei-Faktor-Schutz muss aktiv sein).
3. Wähle **Einzelperson**. Im App Store erscheint dann dein echter Name als Anbieter. Möchtest du eine Firma
   anzeigen, brauchst du eine D-U-N-S-Nummer.
4. Bezahle direkt in der App. Die Freischaltung dauert meist wenige Stunden bis 2 Tage.

> Für Schritte 2 bis 5 nutzt du **Safari → aA → Desktop-Website anfordern**, weil die Apple-Seiten auf dem iPhone sonst eingeschränkt sind.

## Schritt 2 – App-Kennung mit Push anlegen
1. Öffne developer.apple.com/account → **Certificates, Identifiers & Profiles → Identifiers → +**.
2. **App IDs → App** auswählen, als Beschreibung `Leonida Explorer` eingeben.
3. **Bundle ID: Explicit** = `de.leonida.explorer`.
4. Unter Capabilities **Push Notifications** anhaken, dann **Continue → Register**.

## Schritt 3 – Apple-Push-Schlüssel (.p8) erstellen
1. Gehe auf **Keys → +**, als Name `Leonida Push` eingeben und **Apple Push Notifications service (APNs)** anhaken.
   Danach **Continue → Register**.
2. Tippe auf **Download**. Die `.p8`-Datei lässt sich **nur einmal** herunterladen. Bewahre sie in der Dateien-App auf.
3. Notiere die **Key ID** (10 Zeichen) und deine **Team ID** (oben rechts bzw. unter Membership).
4. Sag mir Bescheid. Ich öffne dann ein sicheres Eingabefeld für `APNS_TEAM_ID`, `APNS_KEY_ID` und
   `APNS_PRIVATE_KEY` (den kompletten Textinhalt der .p8-Datei inklusive `-----BEGIN PRIVATE KEY-----`).
   Bitte schick den Schlüssel **nicht** im Chat.

## Schritt 4 – App in App Store Connect anlegen
1. Öffne appstoreconnect.apple.com → **Apps → + → Neue App**.
2. Trage ein: Plattform **iOS**, Name z. B. **„Leonida Explorer – Fan-Karte“**, Sprache **Deutsch**,
   Bundle-ID `de.leonida.explorer`, SKU `leonida-explorer`, Zugriff **Vollständig**.
3. ⚠️ **„GTA VI“ bitte nicht in Name, Untertitel, Symbol oder Screenshots verwenden.** „GTA“ ist eine Marke von
   Rockstar/Take-Two. Apple lehnt solche Apps nach Richtlinie 5.2.1 (geistiges Eigentum) in der Regel ab.
   Erlaubt ist ein Hinweis in der Beschreibung, etwa: „Inoffizielle Fan-Community-Karte, nicht verbunden mit Rockstar Games.“

## Schritt 5 – App-Store-Connect-API-Schlüssel (für Codemagic)
1. Öffne App Store Connect → **Benutzer und Zugriff → Integrationen → App Store Connect API → Team-Schlüssel → +**.
2. Als Name `Codemagic` eingeben, Zugriff **App-Manager**, dann **Generieren**.
3. Lade die `.p8` herunter (das geht nur einmal) und notiere die **Issuer ID** und die **Schlüssel-ID**.

## Schritt 6 – Codemagic einrichten (baut die App ohne Mac)
1. Speichere das Projekt bei GitHub (wie bisher über Emergent → „Save to GitHub“).
2. Öffne codemagic.io → **Sign up with GitHub** und gib das Leonida-Repository frei.
   Im kostenlosen Tarif sind 500 Build-Minuten pro Monat enthalten, ein Build dauert etwa 10 bis 15 Minuten.
3. Öffne **Team settings → Integrations → Developer Portal → Connect**:
   - Name: **`leonida-asc`** (genau so, so steht es in `codemagic.yaml`)
   - Issuer ID, Key ID und .p8 aus Schritt 5 eintragen.
4. Öffne **Apps → Add application → GitHub → Repository wählen → „codemagic.yaml“** verwenden.
5. Tippe auf **Start new build → Workflow „iOS TestFlight“ → Start**.
   Codemagic erstellt automatisch Zertifikat und Profil, baut die App und lädt sie zu TestFlight hoch.
6. Schlägt ein Build fehl, schick mir einen Screenshot der roten Zeile aus dem Build-Log.

## Schritt 7 – Auf deinem iPhone testen (TestFlight)
1. Installiere die App **TestFlight** aus dem App Store.
2. Öffne App Store Connect → deine App → **TestFlight → Interne Tests → +**, lege eine Gruppe an und füge dich
   selbst hinzu. Die Einladung kommt per E-Mail.
3. Teste die App:
   - Anmelden, Karte, Fundort einreichen, Profilbild hochladen (Kamera/Fotos-Abfrage)
   - Profil → **Push-Benachrichtigungen aktivieren** → erlauben → **Test senden** → iPhone sperren.
     Die Mitteilung sollte kommen, Antippen öffnet die richtige Seite.
   - Flugmodus einschalten und App neu öffnen: Die Seite „Keine Verbindung“ erscheint.

## Schritt 8 – Für die Prüfung einreichen
In App Store Connect → deine App → Version 1.0:
- **Screenshots:** mindestens 3 Bilder im Format 6,9" (1320 × 2868), direkt am iPhone mit der TestFlight-App aufgenommen.
  Keine GTA-Logos verwenden.
- **Beschreibung, Schlüsselwörter, Support-URL:** `https://leonida-preview-2.emergent.host`
- **Datenschutz-URL:** `https://leonida-preview-2.emergent.host/datenschutz`
- **App-Datenschutz** (Fragebogen):
  - Kontaktinfos: E-Mail-Adresse
  - Nutzerinhalte: Fotos, sonstige Inhalte und Nachrichten
  - Kennungen: Nutzer-ID und Geräte-ID (Push)
  - Nutzungsdaten: Produktinteraktion
  - Alles davon gilt als „mit Identität verknüpft“ und wird **nicht** für Tracking genutzt.
- **Altersfreigabe:** Fragebogen ehrlich ausfüllen. Weil es Chats mit anderen Nutzern gibt, ergibt sich meist 12+ oder höher.
- **Anmeldedaten für die Prüfung:** Lege ein eigenes Testkonto an (z. B. `review@…`), bestätige die E-Mail und
  trage E-Mail und Passwort ein. Ohne dieses Konto lehnt Apple die App ab.
- **Notizen für die Prüfung** (kopieren und anpassen):
  > Leonida Explorer is an unofficial fan community map. User-generated content is moderated:
  > users must accept the Terms (zero tolerance for objectionable content) at sign-up; users can report
  > messages and profiles and block users (user profile → "…" button; community chat message → "…" button);
  > admins review reports within 24 hours and can remove content and ban accounts. New map entries are
  > published only after admin approval. Account deletion: Profile → "Konto löschen".
  > Push notifications inform about friend requests and private messages.
- Tippe auf **Zur Prüfung hinzufügen → Einreichen**. Die Prüfung dauert meist 1 bis 3 Tage.

## Was Apple besonders prüft (und schon eingebaut ist)
| Apple-Regel | Umsetzung in Leonida Explorer |
|---|---|
| 1.2 Nutzerinhalte: Regeln akzeptieren | Häkchen „Nutzungsbedingungen + Community-Regeln“ bei der Registrierung |
| 1.2 Melden und Blockieren | Melden von Nutzern und Nachrichten, Blockieren, Sperren durch Admins (SQL 008) |
| 1.2 Reaktion innerhalb von 24 h | In den Nutzungsbedingungen zugesagt. **Bitte auch wirklich einhalten** |
| 5.1.1(v) Konto löschen | Profil → „Konto löschen“ (SQL 011) |
| 5.1.1 Datenschutzerklärung | Seite `/datenschutz` (Angaben in `LegalPage.tsx` ergänzen) |
| 4.2 Mehr als eine Website | Echte Push-Mitteilungen über Apple, eigene Seite ohne Internet, Kamera- und Fotozugriff |
| 5.2.1 Markenrechte | Kein „GTA“ im Namen, Symbol oder in den Screenshots, Fan-Hinweis in den Nutzungsbedingungen |

**Restrisiko:** Apps, die eine Website live laden, lehnt Apple gelegentlich nach Richtlinie 4.2 ab. Passiert das,
kann die App ihre Inhalte stattdessen fest eingebaut mitbringen. Sag mir dann Bescheid.

## Wichtig zu wissen
- Die iPhone-App hat **eigene Anmeldedaten** auf dem Gerät. Du meldest dich dort also einmal neu an.
  Alle Daten liegen auf dem Server, es geht nichts verloren.
- Damit E-Mail-Links (Bestätigung, Passwort vergessen) funktionieren, muss
  `https://leonida-preview-2.emergent.host/**` in Lovable unter Auth → Redirect URLs eingetragen sein.
  Diese Links öffnen sich in Safari, danach meldest du dich in der App an.
- Ändert sich die Live-Adresse (z. B. eigene Domain), musst du sie in `capacitor.config.ts`
  (`LIVE_URL`) und in `ios-shell/index.html` anpassen und danach einen neuen Codemagic-Build starten.
