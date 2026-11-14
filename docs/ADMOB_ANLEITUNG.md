# Google AdMob – Rewarded Ads in Leonida Fishing

Stand: Plugin **@capacitor-community/admob 8.3.0** (Google Mobile Ads SDK 13.11 + UMP 3.1, Swift Package Manager, passend zu Capacitor 8.6).

## Was die Spieler sehen
- In Leonida Fishing (nur in der iPhone-App, nur angemeldet, nur zwischen den Würfen) gibt es zwei Buttons:
  - **Werbung ansehen – 5 Bonus-Fänge** (EN: 🎬 WATCH AD – GET 5 CASTS) – max. **2× pro Tag**.
  - **Werbung ansehen – Spezialköder erhalten** (EN: 🎬 WATCH AD – GET SPECIAL BAIT) – **1 Epischer Köder** (3 Würfe, wie gekauft), max. **1× pro Tag**.
- Anzeige „x/2 verfügbar“ bzw. „x/1 verfügbar“. Vor dem Start ein Dialog mit der versprochenen Belohnung und der echten Fangchance.
- Tagesgrenze: **Mitternacht deutscher Zeit** (wie die 15 täglichen Würfe). Bonus-Angelversuche verfallen nicht (bestehende Regel).
- Nur nicht-personalisierte Werbung, **keine Tracking-Abfrage (ATT)**. Im EWR/UK/CH zeigt Google die Einwilligungsabfrage (UMP); änderbar über „Werbe-Datenschutz“.

## Wo was eingetragen ist
| Wert | Ort |
|---|---|
| AdMob **App-ID** `ca-app-pub-4817586991799948~3790557761` | `ios/App/App/Info.plist` → `GADApplicationIdentifier` (optional überschreibbar mit Codemagic-Variable `ADMOB_IOS_APP_ID`) |
| **Modus** off / test / live | Datenbank `ad_reward_config` → im Admin-Bereich **„Werbung (AdMob)“** |
| **Anzeigenblock fishing_bonus_casts** `ca-app-pub-4817586991799948/1554969174` | durch SQL 037 vorbelegt, änderbar im Admin-Bereich „Werbung (AdMob)“ |
| **Anzeigenblock fishing_special_bait** `ca-app-pub-4817586991799948/3031702376` | durch SQL 037 vorbelegt, änderbar im Admin-Bereich „Werbung (AdMob)“ |
| Google-Testanzeigenblock (fest im Code) | `src/lib/ads.ts` → `GOOGLE_TEST_REWARDED_IOS` |

Testmodus = immer Googles offizielle Testanzeigen (`ca-app-pub-3940256099942544/1712485313`) + `initializeForTesting`. Es entstehen keine echten Impressionen.
Live kann erst gespeichert werden, wenn beide produktiven Anzeigenblöcke eingetragen sind (Google-Test-IDs werden für Live abgelehnt).

## Wie die Belohnung sicher vergeben wird
1. Tippen → Dialog → „Werbung starten“.
2. `start_ad_reward` prüft das Tageslimit auf dem Server und legt eine Sitzung an (verbraucht noch nichts).
3. Anzeige laden (mit SSV-Daten: Nutzer-ID + Sitzungsnummer) und zeigen.
4. Nur das offizielle Reward-Ereignis zählt. Vorzeitig geschlossen → „Werbung nicht abgeschlossen. Keine Belohnung vergeben.“
5. **Live:** Google ruft `https://leonida-preview-2.emergent.host/api/admob/ssv` auf. Das Backend prüft die Google-Signatur (ECDSA, Google-Schlüssel) und ruft `admob_ssv_confirm` auf → atomare Gutschrift, Transaktionsnummer eindeutig (kein Replay, keine Doppelbuchung). Die App wartet auf die Bestätigung („Belohnung wird überprüft …“).
   **Test:** `claim_ad_reward_test` (nur erlaubt, solange der Modus „test“ ist; im Protokoll als `test_client` gekennzeichnet).
6. Bricht die Verbindung nach dem Reward ab, merkt sich die App die Sitzung und holt die Bestätigung beim nächsten Öffnen nach. Im Live-Modus schreibt Google ohnehin direkt an den Server.

## Supabase (SQL 037)
- Tabellen: `ad_reward_config` (Modus + Anzeigenblöcke), `ad_reward_sessions` (jeder Werbeversuch, Status pending/granted/expired, `transaction_id` eindeutig).
- Funktionen: `my_ad_reward_state`, `start_ad_reward`, `my_ad_reward_session`, `claim_ad_reward_test`, `admob_ssv_confirm`, `admin_ad_reward_config`, `admin_set_ad_reward_config` (+ intern `ad_reward_grant`, `ad_reward_state_json`, `ad_reward_limit`).
- Selbsttest: `038_selbsttest_werbebelohnungen.sql` (rollt alles zurück, Ziel: „ALLE 16 PRÜFUNGEN OK“).

## Einmalige Schritte
1. **Lovable SQL-Editor:** `docs/migrations/037_werbebelohnungen_admob.sql` ausführen (danach optional 038).
2. **Neuen TestFlight-Build** in Codemagic starten (Workflow „iOS TestFlight“). Der neue Schritt „AdMob (Rewarded Ads) prüfen“ muss grün sein. Ohne neuen Build fehlt das native SDK – die Buttons bleiben dann unsichtbar.
3. **AdMob-Konsole** (vor Live):
   - Zwei Rewarded-Anzeigenblöcke anlegen: `fishing_bonus_casts` und `fishing_special_bait`.
   - Bei beiden **Serverseitige Bestätigung** aktivieren, Callback-URL: `https://leonida-preview-2.emergent.host/api/admob/ssv` (bei eigener Domain diese verwenden).
   - **Datenschutz & Mitteilungen → DSGVO-Mitteilung** (EWR/UK/CH) erstellen und veröffentlichen, Datenschutzerklärung `https://leonida-preview-2.emergent.host/datenschutz` verlinken.
   - `app-ads.txt` auf der Website-Domain hinterlegen (AdMob zeigt den Inhalt an).
4. Der SSV-Schlüssel ist der bestehende Push-Server-Schlüssel (`PUSH_WEBHOOK_SECRET` im Backend = `push_config.secret` in der Datenbank). Admin-Bereich zeigt „SSV-Schlüssel: bereit“.

## App Store Connect – App-Datenschutz (Angaben für das Google Mobile Ads SDK)
- **Datentypen:** Kennungen → *Geräte-ID*; Nutzungsdaten → *Produktinteraktion*, *Werbedaten*; Diagnose → *Absturzdaten*, *Leistungsdaten*; Standort → *Ungefährer Standort* (aus IP).
- Zweck: **Werbung durch Dritte**, Analyse, App-Funktionalität (Betrugsvorbeugung). Mit dem Nutzer verknüpft: nein (nicht-personalisiert). **Tracking: nein** (keine ATT-Abfrage, keine IDFA-Nutzung).
- Altersfreigabe: Inhalte bis „Teen“ (`maxAdContentRating`), keine an Kinder gerichtete App.

## Test auf dem iPhone (TestFlight)
1. SQL 037 ausführen, Admin-Bereich → „Werbung (AdMob)“ → **Test** (Standard) speichern.
2. Neuen TestFlight-Build installieren, anmelden, Arcade → Leonida Fishing.
3. „Werbung ansehen – 5 Bonus-Fänge“ → Dialog → „Werbung starten“ → Google-**Testanzeige** („Test Ad“) ganz ansehen → „+5 Bonus-Angelversuche erhalten!“, Chip „Bonus-Angelversuche“ +5, Zähler 1/2.
4. Nochmal → 0/2, Button gesperrt. Anzeige vorzeitig schließen → keine Belohnung, Zähler unverändert.
5. Köder-Werbung → 1 Epischer Köder (3 Würfe) im Köder-Menü, danach 0/1.
6. App schließen/neu öffnen, ab- und anmelden → Zähler bleiben. Am nächsten Tag (nach Mitternacht) wieder 2/2 und 1/1.
7. Erst nach AdMob-Freigabe: Admin → produktive Anzeigenblöcke eintragen → **Live** speichern.

## Nur nicht personalisierte Werbung (technische Umsetzung)
Leonida Explorer fordert **ausschließlich nicht personalisierte Werbung** an – für alle Rewarded Ads (Bonus-Angelversuche im Spiel, „+5 Fänge“-Fenster, Epischer Köder im Spiel und im Köder-Shop). Das gilt auch dann, wenn ein Nutzer im Google-Einwilligungsformular personalisierter Werbung zustimmt. (Crew-Erstellung per Werbung gibt es in der App nicht – Crews kosten nur Coins.)

Verwendetes Plugin: **@capacitor-community/admob 8.3.0** (Google Mobile Ads SDK 13.11.0, UMP 3.1). Drei Ebenen, Google wendet immer das **restriktivste** Signal an:
1. **Pro Anzeigenanfrage `npa=1`** – `src/lib/ads.ts`: `AdMob.prepareRewardVideoAd({ …, npa: NON_PERSONALIZED_ADS })` (Konstante `true`). Das Plugin hängt nativ das Request-Extra `npa = "1"` an.
2. **Global `publisherPrivacyPersonalizationState = .disabled`** (Googles „Publisher Privacy Treatment“) – wird vor `MobileAds.start` gesetzt und gilt für jede Anfrage der App-Sitzung. Plugin 8.3.0 bietet dafür keine JavaScript-Option, deshalb baut `scripts/admob-npa-patch.mjs` die Zeile in Codemagic nach `yarn install` in das Plugin ein (idempotent, Build bricht ab, falls die Plugin-Datei nicht passt). Schritt „AdMob nur nicht personalisierte Werbung“ in beiden Codemagic-Workflows.
3. **Keine Werbe-ID:** Es gibt keine App-Tracking-Abfrage (ATT) und kein `NSUserTrackingUsageDescription` – iOS liefert die IDFA daher nicht. Codemagic prüft, dass der Eintrag fehlt.

**Google UMP bleibt aktiv:** Vor der ersten Anzeige fragt die App `requestConsentInfo` ab und zeigt bei Bedarf das Einwilligungsformular (EWR/UK/CH). Unter Leonida Fishing erscheint „Werbe-Datenschutz“, wenn Google Datenschutzoptionen verlangt (`showPrivacyOptionsForm`). Zustimmung zu „Speichern/Zugreifen auf Informationen“ (Zweck 1) braucht Google auch für nicht personalisierte Anzeigen – ohne sie liefert Google keine Werbung („Momentan ist keine Werbung verfügbar“).

**„Leonida Explorer“ im Einwilligungsformular:** Den Namen und das Logo im Formular nimmt Google aus der **AdMob-Konsole**, nicht aus dem App-Code (der Name unter dem App-Symbol ist bereits „Leonida Explorer“, `CFBundleDisplayName`). Prüfen in AdMob:
- **Apps → Leonida Explorer → App-Einstellungen:** App-Name „Leonida Explorer“.
- **Datenschutz & Mitteilungen → DSGVO → Mitteilung bearbeiten:** in der Vorschau oben „Leonida Explorer“ (Name/Logo in den Mitteilungs-Einstellungen anpassbar), Datenschutzerklärung verlinkt, Mitteilung **veröffentlicht**.

### Test (TestFlight)
1. Codemagic-Build starten – im Log muss „✅ AdMob 8.3.0: publisherPrivacyPersonalizationState = .disabled eingebaut“ und „✅ Nur nicht personalisierte Werbung, keine Tracking-Abfrage“ stehen. (Optional zuerst Workflow „iOS Build-Check“.)
2. App vom iPhone löschen und den neuen TestFlight-Build installieren (setzt die gespeicherte Einwilligung zurück).
3. Leonida Fishing → Werbung starten → das Google-Formular muss „Leonida Explorer“ zeigen. Bewusst **„Einwilligen“** (alles zulassen) wählen.
4. Testanzeige ansehen → Belohnung kommt wie gewohnt. Die Anfrage bleibt trotzdem nicht personalisiert (npa=1 + Publisher Privacy Treatment überstimmen die Zustimmung).
5. Datenschutzoptionen erneut öffnen: Button „Werbe-Datenschutz“ unter Leonida Fishing → Auswahl ändern/ablehnen → Werbung funktioniert weiter (nicht personalisiert), solange Zweck 1 erlaubt ist.
6. Technischer Nachweis (optional, Mac mit Xcode): Gerät anschließen, Konsole nach `npa` filtern – die Anzeigenanfrage enthält `npa=1`; im Ad Inspector (Google Mobile Ads) erscheint die Anfrage als nicht personalisiert.
7. Automatisch geprüft (`src/lib/admob-npa.test.ts`): Plugin-Version 8.3.0, Patch genau einmal vor `MobileAds.start`, jede Rewarded-Anfrage mit `npa`, keine Tracking-Abfrage.
