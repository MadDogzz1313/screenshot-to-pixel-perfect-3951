/**
 * Inhalt der Datenschutzerklärung – Deutsch und Englisch in EINER Struktur, damit beide Fassungen
 * Abschnitt für Abschnitt übereinstimmen. Sichtbarer Text bewusst ohne interne Technikbegriffe.
 * Hinweis: Speicherdauer der Meldungen, Anonymisierung freigegebener Fundorte und das Leeren gelöschter
 * Chat-Nachrichten setzen SQL 020 voraus (docs/migrations/020_dsgvo_chat_dm_konto.sql).
 */
export const PRIVACY_CONTACT = { name: "Nico Etterer", email: "n.etterer@outlook.de" };

export type PrivacyLang = "de" | "en";
export type PrivacyItem = { label?: string; text: string };
export type PrivacyBlock = { p: string } | { list: PrivacyItem[] } | { sub: string };
export type PrivacySection = { id: string; title: string; blocks: PrivacyBlock[] };
export type PrivacyDoc = { title: string; tocTitle: string; intro: string[]; sections: PrivacySection[] };

const E = PRIVACY_CONTACT.email;

const de: PrivacyDoc = {
  title: "Datenschutzerklärung",
  tocTitle: "Inhalt",
  intro: [
    "Mit dieser Datenschutzerklärung informieren wir dich darüber, welche personenbezogenen Daten Leonida Explorer verarbeitet, zu welchen Zwecken, auf welcher Rechtsgrundlage und wie lange. Sie gilt für die Website, die auf dem Home-Bildschirm installierbare Web-App und die iPhone-App.",
    "Leonida Explorer ist eine Community-Karte für Fans von GTA VI. Wir verwenden keine Werbung, keine Analyse- oder Tracking-Dienste und verkaufen keine Daten.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      title: "1. Verantwortlicher",
      blocks: [
        { p: `Verantwortlich für die Datenverarbeitung ist ${PRIVACY_CONTACT.name}.` },
        { p: `E-Mail: ${E}` },
        { p: "Bei Fragen zum Datenschutz oder zur Ausübung deiner Rechte kannst du dich jederzeit an diese Adresse wenden." },
      ],
    },
    {
      id: "nutzung",
      title: "2. Aufruf der App",
      blocks: [
        { p: "Beim Aufruf der Website oder der App verarbeiten die Server unserer Dienstleister technisch notwendige Verbindungsdaten, insbesondere IP-Adresse, Zeitpunkt, aufgerufene Adresse sowie Browser- und Geräteinformationen. Das ist erforderlich, um die App auszuliefern und Angriffe oder Missbrauch abzuwehren. Wie lange diese Protokolle gespeichert werden, legt der jeweilige Dienstleister fest." },
        { p: "Schriftarten und alle Bestandteile der App werden von unseren eigenen Servern geladen. Eine Verbindung zu Schriftarten- oder Werbediensten Dritter findet dabei nicht statt." },
      ],
    },
    {
      id: "konto",
      title: "3. Benutzerkonto und Anmeldung",
      blocks: [
        { list: [
          { label: "Gespeicherte Daten", text: "E-Mail-Adresse, Benutzername, eine zufällig erzeugte Konto-ID, Zeitpunkte von Registrierung und Anmeldung sowie dein Passwort. Das Passwort wird verschlüsselt übertragen und nur in unkenntlich gemachter Form (als Hashwert) gespeichert." },
          { label: "E-Mails", text: "Für die Bestätigung deiner E-Mail-Adresse und das Zurücksetzen des Passworts erhältst du E-Mails des Anmeldedienstes." },
          { label: "Pflichtangaben", text: "E-Mail-Adresse, Passwort und Benutzername sind für ein Konto erforderlich. Ohne Konto kannst du die Karte eingeschränkt als Gast nutzen." },
        ] },
      ],
    },
    {
      id: "profil",
      title: "4. Profil, XP und Abzeichen",
      blocks: [
        { p: "In deinem Profil speichern wir Benutzername, Profilbild, Kurzbeschreibung, Beitrittsdatum, ausgewählte Abzeichen und deine Privatsphäre-Einstellungen. Außerdem speichern wir deinen Fortschritt: XP, Level, erhaltene Abzeichen und die Tage, an denen du aktiv warst." },
        { p: "Dein Benutzername und die von dir freigegebenen Profilangaben sind für andere sichtbar, auch ohne Anmeldung. Du kannst einstellen, ob Profilbild, Beitrittsdatum, Abzeichen und Freundesliste angezeigt werden, oder dein Profil auf privat stellen. Profilbilder werden nicht öffentlich gespeichert und nur über zeitlich begrenzte Links angezeigt." },
      ],
    },
    {
      id: "fundorte",
      title: "5. Fundorte und Fotos",
      blocks: [
        { p: "Wenn du einen Fundort einreichst, speichern wir die Angaben zum Fundort (z. B. Titel, Kategorie, Gebiet, Position auf der Karte, Beschreibung, optional Fahrzeug und Uhrzeit), hochgeladene Fotos, dein Konto und den Zeitpunkt. Neue Fundorte und Fotos werden erst nach Prüfung durch einen Admin veröffentlicht und dann mit deinem Benutzernamen angezeigt." },
        { p: "Außerdem speichern wir, welche Fundorte du mit „Gefällt mir“ markierst. Deine Merkliste bleibt nur auf deinem Gerät." },
      ],
    },
    {
      id: "arcade",
      title: "6. Minispiele, Coins und Bestenlisten",
      blocks: [
        { p: "Für die Minispiele der Neon Arcade speichern wir Spielrunden, Punktestände, Arcade-XP, deinen Coin-Kontostand mit den einzelnen Gutschriften und Ausgaben sowie die mit Coins freigeschalteten Fundorte. In Bestenlisten erscheint dein Benutzername mit deinem Ergebnis. Coins haben keinen Geldwert und können nicht gekauft werden." },
      ],
    },
    {
      id: "chat",
      title: "7. Community-Chat",
      blocks: [
        { p: "Im Community-Chat speichern wir deine Nachrichten mit Benutzername und Zeitpunkt sowie gegebenenfalls einen verlinkten Fundort. Der Chat ist nur für angemeldete Nutzer sichtbar. Löschst du eine Nachricht oder entfernt ein Admin sie, wird ihr Text gelöscht." },
      ],
    },
    {
      id: "privatnachrichten",
      title: "8. Freunde und private Nachrichten",
      blocks: [
        { p: "Private Nachrichten sind nur zwischen bestätigten Freunden möglich. Wir speichern Absender, Empfänger, Text, Zeitpunkt und ob die Nachricht gelesen wurde. Lesen können sie nur die beiden Gesprächspartner; Admins haben in der App keinen Zugriff. Meldest du eine Nachricht, wird ausschließlich der Text dieser Nachricht zur Prüfung an die Admins übermittelt." },
        { p: "Wichtig: Private Nachrichten werden verschlüsselt übertragen, sind aber nicht Ende-zu-Ende-verschlüsselt. Sie liegen auf den Servern unseres Datenbankanbieters und sind dort technisch für Personen mit direktem Datenbankzugriff einsehbar. Bitte teile keine sensiblen Informationen." },
        { p: "Für die Freundesfunktion speichern wir Freundschaftsanfragen und bestehende Freundschaften." },
      ],
    },
    {
      id: "crew",
      title: "9. Crew Finder",
      blocks: [
        { p: "Wenn du eine Crew-Suche erstellst oder einer Crew beitrittst, speichern wir die Angaben zur Suche (z. B. Aktivität, Plattform, Sprache, Spielerzahl, Startzeit, Beschreibung), die Mitglieder, Beitrittsanfragen und Crew-Nachrichten. Crew-Nachrichten sind nur für die Mitglieder der Crew sichtbar." },
      ],
    },
    {
      id: "push",
      title: "10. Benachrichtigungen und Push-Mitteilungen",
      blocks: [
        { p: "In der App siehst du Benachrichtigungen, etwa zu neuen Freundschaftsanfragen oder Nachrichten. Dafür speichern wir die Benachrichtigung, wer sie ausgelöst hat und ob du sie gelesen hast." },
        { p: "Push-Mitteilungen erhältst du nur, wenn du sie ausdrücklich aktivierst. Dann speichern wir eine Gerätekennung für Mitteilungen und deine Einstellungen. Die Zustellung läuft über den Mitteilungsdienst deines Browsers bzw. über Apple. Eine Vorschau des Nachrichtentexts wird nur gesendet, wenn du sie einschaltest. Du kannst Push-Mitteilungen jederzeit im Profil oder in den Geräteeinstellungen abschalten; beim Abmelden wird dein Gerät vom Konto getrennt." },
      ],
    },
    {
      id: "moderation",
      title: "11. Melden, Blockieren und Moderation",
      blocks: [
        { list: [
          { label: "Melden", text: "Du kannst Nutzer, Nachrichten und Crew-Suchen melden. Wir speichern, wer was gemeldet hat, den Grund, deine optionale Beschreibung, bei Nachrichten deren Text sowie den Bearbeitungsstand. Meldungen sehen nur Admins. Die gemeldete Person erfährt nicht, wer sie gemeldet hat." },
          { label: "Blockieren", text: "Blockierst du jemanden, kann diese Person dir keine privaten Nachrichten und Freundschaftsanfragen mehr senden, eine bestehende Freundschaft endet und ihr seht eure Nachrichten im Community-Chat gegenseitig nicht mehr. Die Person wird darüber nicht informiert. Die Blockierung bleibt gespeichert, bis du sie aufhebst." },
          { label: "Moderation", text: "Admins können gemeldete Inhalte entfernen und Nutzer verwarnen, vorübergehend stummschalten oder sperren. Solche Maßnahmen werden mit Grund und Zeitpunkt dokumentiert. Zum Schutz vor Spam begrenzt die App außerdem, wie viele Nachrichten oder Meldungen in kurzer Zeit gesendet werden können." },
        ] },
      ],
    },
    {
      id: "spenden",
      title: "12. Spenden",
      blocks: [
        { p: "Auf der Website kannst du freiwillig über den Zahlungsdienst Stripe spenden; in der iPhone-App gibt es keine Spendenfunktion. Deine Zahlungsdaten gibst du direkt bei Stripe ein, wir erhalten sie nicht. Wir speichern zur Abwicklung eine Zahlungsreferenz, dein Konto, Betrag, Währung, Zahlungsstatus und Zeitpunkt. Die Spende bringt keine XP, Abzeichen oder Vorteile im Spiel." },
      ],
    },
    {
      id: "werbung",
      title: "Freiwillige Werbung in Leonida Fishing (Google AdMob, nur iPhone-App)",
      blocks: [
        { p: "In der iPhone-App kannst du in Leonida Fishing freiwillig ein Werbevideo ansehen, um 5 Bonus-Angelversuche (höchstens 2× pro Tag) oder einen Epischen Köder (1× pro Tag) zu erhalten. Werbung startet nie automatisch, nur nach deinem Tippen und einer Bestätigung." },
        { p: "Anbieter ist Google Ireland Limited (Google AdMob / Google Mobile Ads SDK). Beim Laden und Anzeigen einer Anzeige verarbeitet Google technische Daten wie IP-Adresse, Gerätetyp, Betriebssystem, App-Version, Spracheinstellung, ungefähren Standort aus der IP-Adresse sowie Interaktionen mit der Anzeige (z. B. ob sie vollständig angesehen wurde), um die Anzeige auszuliefern, Betrug zu verhindern und Reichweiten zu messen." },
        { list: [
          { label: "Keine personalisierte Werbung", text: "Wir fordern ausschließlich nicht-personalisierte Anzeigen an und fragen keine App-Tracking-Erlaubnis (Apple ATT) ab; die Werbe-ID (IDFA) wird nicht genutzt." },
          { label: "Einwilligung", text: "Im EWR, im Vereinigten Königreich und in der Schweiz holt Google über die User Messaging Platform (UMP) die erforderliche Einwilligung ein. Du kannst sie in Leonida Fishing unter „Werbe-Datenschutz“ jederzeit ändern." },
          { label: "Belohnungsprüfung", text: "Damit Belohnungen nur einmal und nur für vollständig angesehene Werbung vergeben werden, übermittelt Google nach dem Ansehen eine signierte Bestätigung (Transaktionsnummer, Anzeigenblock, deine Nutzer-ID und eine Sitzungsnummer) an unseren Server. Wir speichern pro Werbeversuch Zeitpunkt, Art der Belohnung und Status, solange dein Konto besteht." },
          { label: "Rechtsgrundlage", text: "Art. 6 Abs. 1 lit. b DSGVO (Erbringung der gewünschten Belohnung), Art. 6 Abs. 1 lit. a DSGVO bzw. § 25 Abs. 1 TDDDG, soweit eine Einwilligung erforderlich ist." },
          { label: "Weitere Informationen", text: "https://policies.google.com/technologies/ads und https://policies.google.com/privacy" },
        ] },
      ],
    },
    {
      id: "geraet",
      title: "13. Speicherung auf deinem Gerät",
      blocks: [
        { p: "Damit die App funktioniert, speichert sie einige Informationen lokal im Speicher deines Browsers bzw. deines iPhones:" },
        { list: [
          { text: "deine Anmeldung, damit du nicht bei jedem Öffnen neu einloggen musst (wird beim Abmelden entfernt)," },
          { text: "die gewählte Sprache, deine Merkliste, ob du als Gast unterwegs bist und die gewählte Kameraansicht im Minispiel," },
          { text: "in der iPhone-App die Gerätekennung für Push-Mitteilungen sowie kurzzeitig, welche Seite nach dem Antippen einer Mitteilung geöffnet werden soll," },
          { text: "ein Cookie, das sich merkt, ob die Seitenleiste ein- oder ausgeklappt ist (Speicherdauer sieben Tage)." },
        ] },
        { p: "Diese Speicherungen sind für die von dir genutzten Funktionen erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Cookies oder ähnliche Techniken für Analyse oder Werbung verwenden wir nicht." },
      ],
    },
    {
      id: "dienstleister",
      title: "14. Dienstleister und Empfänger",
      blocks: [
        { p: "Wir setzen folgende Dienstleister ein. Sie erhalten nur die Daten, die für ihre jeweilige Aufgabe nötig sind:" },
        { list: [
          { label: "Supabase (bereitgestellt über Lovable Cloud)", text: "Anmeldung und Versand der Konto-E-Mails, Datenbank, Speicherung von Bildern und Live-Übertragung von Nachrichten. Supabase verarbeitet die Daten in unserem Auftrag." },
          { label: "Emergent", text: "Hosting der Website und App sowie Betrieb eines Servers, der Push-Mitteilungen versendet und Spenden abwickelt. Emergent verarbeitet die Daten in unserem Auftrag." },
          { label: "Apple und Browser-Mitteilungsdienste", text: "Zustellung von Push-Mitteilungen, nur wenn du sie aktiviert hast." },
          { label: "Stripe", text: "Abwicklung von Spenden auf der Website. Stripe verarbeitet Zahlungsdaten auch in eigener Verantwortung; ergänzend gilt die Datenschutzerklärung von Stripe." },
        ] },
        { p: "Darüber hinaus geben wir Daten nur weiter, wenn wir gesetzlich dazu verpflichtet sind." },
      ],
    },
    {
      id: "drittland",
      title: "15. Übermittlung in Drittländer",
      blocks: [
        { p: "Einige der genannten Dienstleister haben ihren Sitz in den USA oder setzen dort Unterauftragnehmer ein. Eine Übermittlung dorthin erfolgt auf Grundlage eines Angemessenheitsbeschlusses der EU-Kommission (EU-U.S. Data Privacy Framework), soweit der Anbieter danach zertifiziert ist, oder auf Grundlage der von der EU-Kommission erlassenen Standardvertragsklauseln." },
      ],
    },
    {
      id: "rechtsgrundlagen",
      title: "16. Rechtsgrundlagen",
      blocks: [
        { list: [
          { label: "Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag)", text: "Konto, Profil, Fundorte, Fortschritt, Minispiele, Community-Chat, Freunde, private Nachrichten, Crew Finder, Benachrichtigungen in der App und Kontolöschung." },
          { label: "Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)", text: "Push-Mitteilungen. Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen, indem du Push-Mitteilungen abschaltest." },
          { label: "Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)", text: "Technische Bereitstellung, Sicherheit, Schutz vor Spam und Missbrauch sowie Melden, Blockieren und Moderation. Unser Interesse ist ein sicherer und respektvoller Umgang in der Community." },
          { label: "Art. 6 Abs. 1 lit. c DSGVO (rechtliche Pflicht)", text: "Aufbewahrung von Unterlagen zu Spenden, soweit eine gesetzliche Pflicht besteht." },
        ] },
        { p: "Eine automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO findet nicht statt." },
      ],
    },
    {
      id: "speicherdauer",
      title: "17. Speicherdauer",
      blocks: [
        { list: [
          { label: "Konto, Profil, Fortschritt, Coins, Freundschaften und Einstellungen", text: "bis zur Löschung deines Kontos." },
          { label: "Fundorte und Fotos", text: "bis du sie löschst oder dein Konto löschst; zur Behandlung freigegebener Fundorte siehe „Konto löschen“." },
          { label: "Nachrichten", text: "bis du sie löschst oder bis eines der beteiligten Konten gelöscht wird. Bei gelöschten privaten Nachrichten bleibt nur der Hinweis „Nachricht gelöscht“ ohne Text." },
          { label: "Benachrichtigungen", text: "bis zur Löschung deines Kontos oder des Kontos, das sie ausgelöst hat." },
          { label: "Blockierungen", text: "bis du sie aufhebst oder eines der Konten gelöscht wird." },
          { label: "Meldungen", text: "bis zur Bearbeitung und danach sechs Monate; anschließend werden sie automatisch gelöscht. Meldungen von oder über ein gelöschtes Konto werden mit dem Konto gelöscht." },
          { label: "Moderationsmaßnahmen", text: "Sperren bis zu ihrem Ablauf oder ihrer Aufhebung. Dokumentierte Maßnahmen bleiben nach einer Kontolöschung ohne Verbindung zum gelöschten Konto erhalten." },
          { label: "Spam-Schutz", text: "Zähler für gesendete Nachrichten und Meldungen höchstens 24 Stunden." },
          { label: "Push-Mitteilungen", text: "bis du sie abschaltest, dich abmeldest oder dein Konto löschst. Nicht mehr gültige Gerätekennungen werden automatisch entfernt." },
          { label: "Crew-Suchen", text: "Abgelaufene Suchen werden automatisch entfernt, sobald sie länger als sieben Tage abgelaufen sind und eine neue Suche erstellt wird." },
          { label: "Spenden", text: "werden nicht automatisch mit dem Konto gelöscht, sondern aufbewahrt, soweit gesetzliche Aufbewahrungspflichten bestehen. Im Übrigen löschen wir sie auf Anfrage." },
        ] },
        { p: "Gelöschte Daten können noch für begrenzte Zeit in automatischen Sicherungskopien unseres Datenbankanbieters enthalten sein, bis diese planmäßig überschrieben werden." },
      ],
    },
    {
      id: "konto-loeschen",
      title: "18. Konto löschen",
      blocks: [
        { p: "Du kannst dein Konto jederzeit selbst in deinem Profil unter „Konto löschen“ löschen. Dabei werden sofort und endgültig gelöscht:" },
        { list: [
          { text: "deine Anmeldedaten und dein Profil einschließlich Profilbild," },
          { text: "XP, Abzeichen, Coins, Spielstände und Einstellungen," },
          { text: "deine Nachrichten im Community-Chat und in Crews," },
          { text: "alle privaten Gespräche, an denen du beteiligt warst, für beide Gesprächspartner," },
          { text: "Freundschaften, Anfragen, Blockierungen, Benachrichtigungen und Push-Geräte," },
          { text: "Meldungen von dir oder über dich sowie" },
          { text: "alle Fundorte und Fotos, die noch nicht freigegeben wurden." },
        ] },
        { p: "Bereits freigegebene Fundorte und ihre veröffentlichten Fotos bleiben als Beitrag zur Community-Karte erhalten. Sie werden anonymisiert, also keinem Konto mehr zugeordnet, und mit „Gelöschter Nutzer“ angezeigt. Möchtest du, dass auch diese Beiträge entfernt werden, schreibe uns an " + E + "." },
        { p: "Du kannst die Löschung deines Kontos auch per E-Mail beantragen." },
      ],
    },
    {
      id: "rechte",
      title: "19. Deine Rechte",
      blocks: [
        { p: "Du hast nach der DSGVO folgende Rechte:" },
        { list: [
          { label: "Auskunft", text: "über die zu dir gespeicherten Daten (Art. 15)," },
          { label: "Berichtigung", text: "unrichtiger Daten (Art. 16)," },
          { label: "Löschung", text: "deiner Daten (Art. 17)," },
          { label: "Einschränkung", text: "der Verarbeitung (Art. 18)," },
          { label: "Datenübertragbarkeit", text: "(Art. 20)," },
          { label: "Widerspruch", text: "gegen Verarbeitungen, die auf unserem berechtigten Interesse beruhen (Art. 21)," },
          { label: "Widerruf", text: "einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3)." },
        ] },
        { p: `Für deine Anfrage genügt eine E-Mail an ${E}. Viele Angaben kannst du auch direkt in der App ändern oder löschen.` },
        { p: "Außerdem hast du das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, insbesondere in dem EU-Mitgliedstaat, in dem du wohnst oder arbeitest (Art. 77 DSGVO)." },
      ],
    },
    {
      id: "sicherheit",
      title: "20. Sicherheit",
      blocks: [
        { p: "Alle Verbindungen zur App sind verschlüsselt. Der Zugriff auf Daten ist auf dem Server durch Zugriffsregeln beschränkt, sodass Nutzer nur die Daten sehen und ändern können, für die sie berechtigt sind. Einen vollständigen Schutz kann jedoch kein Onlinedienst garantieren." },
      ],
    },
    {
      id: "aenderungen",
      title: "21. Änderungen",
      blocks: [
        { p: "Wir passen diese Datenschutzerklärung an, wenn sich die App oder die Datenverarbeitung ändert. Es gilt jeweils die hier veröffentlichte Fassung." },
      ],
    },
  ],
};

const en: PrivacyDoc = {
  title: "Privacy Policy",
  tocTitle: "Contents",
  intro: [
    "This Privacy Policy explains which personal data Leonida Explorer processes, for which purposes, on which legal basis and for how long. It applies to the website, the web app that can be installed on your home screen, and the iPhone app.",
    "Leonida Explorer is a community map for GTA VI fans. We do not use advertising or any analytics or tracking services, and we do not sell data.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      title: "1. Controller",
      blocks: [
        { p: `The controller responsible for data processing is ${PRIVACY_CONTACT.name}.` },
        { p: `Email: ${E}` },
        { p: "You can contact this address at any time with questions about data protection or to exercise your rights." },
      ],
    },
    {
      id: "nutzung",
      title: "2. Accessing the App",
      blocks: [
        { p: "When you open the website or the app, our service providers’ servers process technically necessary connection data, in particular IP address, time, requested address, and browser and device information. This is required to deliver the app and to defend against attacks or misuse. How long these logs are kept is determined by the respective provider." },
        { p: "Fonts and all other parts of the app are loaded from our own servers. No connection is made to third-party font or advertising services." },
      ],
    },
    {
      id: "konto",
      title: "3. User Account and Sign-in",
      blocks: [
        { list: [
          { label: "Data stored", text: "email address, username, a randomly generated account ID, times of registration and sign-in, and your password. The password is transmitted encrypted and stored only in an unreadable form (as a hash)." },
          { label: "Emails", text: "You receive emails from the sign-in service to confirm your email address and to reset your password." },
          { label: "Required data", text: "Email address, password and username are required for an account. Without an account, you can use the map in a limited way as a guest." },
        ] },
      ],
    },
    {
      id: "profil",
      title: "4. Profile, XP and Badges",
      blocks: [
        { p: "Your profile stores your username, profile picture, short bio, join date, selected badges and your privacy settings. We also store your progress: XP, level, earned badges and the days on which you were active." },
        { p: "Your username and the profile details you choose to share are visible to others, including people who are not signed in. You can choose whether your profile picture, join date, badges and friends list are shown, or set your profile to private. Profile pictures are not stored publicly and are only displayed via time-limited links." },
      ],
    },
    {
      id: "fundorte",
      title: "5. Spots and Photos",
      blocks: [
        { p: "When you submit a spot, we store the spot details (e.g. title, category, area, position on the map, description, optionally vehicle and time of day), uploaded photos, your account and the time. New spots and photos are only published after review by an admin and are then shown with your username." },
        { p: "We also store which spots you “like”. Your saved list stays on your device only." },
      ],
    },
    {
      id: "arcade",
      title: "6. Mini-games, Coins and Leaderboards",
      blocks: [
        { p: "For the Neon Arcade mini-games, we store game rounds, scores, Arcade XP, your coin balance with individual credits and spending, and the spots unlocked with coins. Leaderboards show your username with your result. Coins have no monetary value and cannot be purchased." },
      ],
    },
    {
      id: "chat",
      title: "7. Community Chat",
      blocks: [
        { p: "In the community chat, we store your messages with username and time and, where applicable, a linked spot. The chat is only visible to signed-in users. If you delete a message or an admin removes it, its text is deleted." },
      ],
    },
    {
      id: "privatnachrichten",
      title: "8. Friends and Private Messages",
      blocks: [
        { p: "Private messages are only possible between confirmed friends. We store sender, recipient, text, time and whether the message has been read. Only the two participants can read them; admins have no access in the app. If you report a message, only the text of that message is passed to the admins for review." },
        { p: "Important: private messages are transmitted encrypted but are not end-to-end encrypted. They are stored on our database provider’s servers and are technically accessible there to persons with direct database access. Please do not share sensitive information." },
        { p: "For the friends feature, we store friend requests and existing friendships." },
      ],
    },
    {
      id: "crew",
      title: "9. Crew Finder",
      blocks: [
        { p: "When you create a crew search or join a crew, we store the search details (e.g. activity, platform, language, number of players, start time, description), the members, join requests and crew messages. Crew messages are only visible to members of that crew." },
      ],
    },
    {
      id: "push",
      title: "10. Notifications and Push Notifications",
      blocks: [
        { p: "The app shows you notifications, for example about new friend requests or messages. For this, we store the notification, who triggered it and whether you have read it." },
        { p: "You only receive push notifications if you explicitly turn them on. We then store a device identifier for notifications and your settings. Delivery runs through your browser’s notification service or through Apple. A preview of the message text is only sent if you turn it on. You can turn off push notifications at any time in your profile or in your device settings; signing out disconnects your device from your account." },
      ],
    },
    {
      id: "moderation",
      title: "11. Reporting, Blocking and Moderation",
      blocks: [
        { list: [
          { label: "Reporting", text: "You can report users, messages and crew searches. We store who reported what, the reason, your optional description, for messages their text, and the processing status. Only admins can see reports. The reported person is not told who reported them." },
          { label: "Blocking", text: "If you block someone, that person can no longer send you private messages or friend requests, an existing friendship ends, and you no longer see each other’s messages in the community chat. The person is not notified. The block remains stored until you lift it." },
          { label: "Moderation", text: "Admins can remove reported content and warn, temporarily mute or suspend users. Such measures are documented with reason and time. To prevent spam, the app also limits how many messages or reports can be sent within a short time." },
        ] },
      ],
    },
    {
      id: "spenden",
      title: "12. Donations",
      blocks: [
        { p: "On the website, you can make a voluntary donation through the payment service Stripe; the iPhone app has no donation feature. You enter your payment details directly with Stripe; we do not receive them. For processing, we store a payment reference, your account, amount, currency, payment status and time. Donations provide no XP, badges, or in-game benefits." },
      ],
    },
    {
      id: "werbung",
      title: "Optional ads in Leonida Fishing (Google AdMob, iPhone app only)",
      blocks: [
        { p: "In the iPhone app you can voluntarily watch an ad video in Leonida Fishing to receive 5 bonus casts (at most twice a day) or one epic bait (once a day). Ads never start automatically – only after you tap and confirm." },
        { p: "The provider is Google Ireland Limited (Google AdMob / Google Mobile Ads SDK). When an ad is loaded and shown, Google processes technical data such as IP address, device type, operating system, app version, language, approximate location derived from the IP address and interactions with the ad (e.g. whether it was watched completely) to deliver the ad, prevent fraud and measure reach." },
        { list: [
          { label: "No personalised ads", text: "We only request non-personalised ads and do not ask for App Tracking Transparency permission; the advertising ID (IDFA) is not used." },
          { label: "Consent", text: "In the EEA, the UK and Switzerland Google collects the required consent via its User Messaging Platform (UMP). You can change it at any time in Leonida Fishing under “Ad privacy”." },
          { label: "Reward verification", text: "To make sure rewards are granted only once and only for fully watched ads, Google sends a signed confirmation (transaction number, ad unit, your user ID and a session number) to our server. For each ad attempt we store time, reward type and status for as long as your account exists." },
          { label: "Legal basis", text: "Art. 6(1)(b) GDPR (providing the requested reward), Art. 6(1)(a) GDPR and Section 25(1) TDDDG where consent is required." },
          { label: "More information", text: "https://policies.google.com/technologies/ads and https://policies.google.com/privacy" },
        ] },
      ],
    },
    {
      id: "geraet",
      title: "13. Storage on Your Device",
      blocks: [
        { p: "To work properly, the app stores some information locally in your browser’s or iPhone’s storage:" },
        { list: [
          { text: "your sign-in, so you do not have to log in every time you open the app (removed when you sign out)," },
          { text: "your chosen language, your saved list, whether you are using the app as a guest, and the camera view selected in the mini-game," },
          { text: "in the iPhone app, the device identifier for push notifications and, briefly, which page should open after you tap a notification," },
          { text: "a cookie that remembers whether the sidebar is expanded or collapsed (stored for seven days)." },
        ] },
        { p: "This storage is required for the features you use (Section 25(2) No. 2 TDDDG, German Telecommunications Digital Services Data Protection Act). We do not use cookies or similar technologies for analytics or advertising." },
      ],
    },
    {
      id: "dienstleister",
      title: "14. Service Providers and Recipients",
      blocks: [
        { p: "We use the following service providers. They only receive the data required for their respective task:" },
        { list: [
          { label: "Supabase (provided via Lovable Cloud)", text: "sign-in and sending of account emails, database, image storage and live delivery of messages. Supabase processes the data on our behalf." },
          { label: "Emergent", text: "hosting of the website and app and operation of a server that sends push notifications and processes donations. Emergent processes the data on our behalf." },
          { label: "Apple and browser notification services", text: "delivery of push notifications, only if you have turned them on." },
          { label: "Stripe", text: "processing of donations on the website. Stripe also processes payment data under its own responsibility; Stripe’s privacy policy applies in addition." },
        ] },
        { p: "Beyond this, we only disclose data if we are legally required to do so." },
      ],
    },
    {
      id: "drittland",
      title: "15. Transfers to Third Countries",
      blocks: [
        { p: "Some of the service providers mentioned are based in the USA or use sub-processors there. Transfers are based on an adequacy decision of the European Commission (EU-U.S. Data Privacy Framework), where the provider is certified under it, or on the Standard Contractual Clauses adopted by the European Commission." },
      ],
    },
    {
      id: "rechtsgrundlagen",
      title: "16. Legal Bases",
      blocks: [
        { list: [
          { label: "Art. 6(1)(b) GDPR (terms of use)", text: "account, profile, spots, progress, mini-games, community chat, friends, private messages, Crew Finder, in-app notifications and account deletion." },
          { label: "Art. 6(1)(a) GDPR (consent)", text: "push notifications. You can withdraw your consent at any time with effect for the future by turning off push notifications." },
          { label: "Art. 6(1)(f) GDPR (legitimate interests)", text: "technical provision, security, protection against spam and misuse, as well as reporting, blocking and moderation. Our interest is a safe and respectful community." },
          { label: "Art. 6(1)(c) GDPR (legal obligation)", text: "retention of donation records where required by law." },
        ] },
        { p: "There is no automated decision-making within the meaning of Art. 22 GDPR." },
      ],
    },
    {
      id: "speicherdauer",
      title: "17. Retention Periods",
      blocks: [
        { list: [
          { label: "Account, profile, progress, coins, friendships and settings", text: "until your account is deleted." },
          { label: "Spots and photos", text: "until you delete them or delete your account; for approved spots, see “Deleting Your Account”." },
          { label: "Messages", text: "until you delete them or until one of the accounts involved is deleted. For deleted private messages, only the note “Message deleted” remains, without text." },
          { label: "Notifications", text: "until your account or the account that triggered them is deleted." },
          { label: "Blocks", text: "until you lift them or one of the accounts is deleted." },
          { label: "Reports", text: "until they have been handled and for six months afterwards; they are then deleted automatically. Reports from or about a deleted account are deleted together with the account." },
          { label: "Moderation measures", text: "suspensions until they expire or are lifted. Documented measures remain after an account is deleted, without any link to the deleted account." },
          { label: "Spam protection", text: "counters for sent messages and reports for a maximum of 24 hours." },
          { label: "Push notifications", text: "until you turn them off, sign out or delete your account. Device identifiers that are no longer valid are removed automatically." },
          { label: "Crew searches", text: "expired searches are removed automatically once they have been expired for more than seven days and a new search is created." },
          { label: "Donations", text: "are not deleted automatically with the account but kept as long as statutory retention obligations apply. Otherwise, we delete them on request." },
        ] },
        { p: "Deleted data may remain for a limited time in our database provider’s automatic backups until these are overwritten as scheduled." },
      ],
    },
    {
      id: "konto-loeschen",
      title: "18. Deleting Your Account",
      blocks: [
        { p: "You can delete your account yourself at any time in your profile under “Delete account”. The following is deleted immediately and permanently:" },
        { list: [
          { text: "your sign-in data and your profile, including your profile picture," },
          { text: "XP, badges, coins, game scores and settings," },
          { text: "your messages in the community chat and in crews," },
          { text: "all private conversations you took part in, for both participants," },
          { text: "friendships, requests, blocks, notifications and push devices," },
          { text: "reports from you or about you, and" },
          { text: "all spots and photos that have not yet been approved." },
        ] },
        { p: "Spots that have already been approved and their published photos remain as contributions to the community map. They are anonymised, meaning they are no longer linked to any account, and are shown as “Deleted user”. If you would like these contributions removed as well, email us at " + E + "." },
        { p: "You can also request the deletion of your account by email." },
      ],
    },
    {
      id: "rechte",
      title: "19. Your Rights",
      blocks: [
        { p: "Under the GDPR, you have the following rights:" },
        { list: [
          { label: "Access", text: "to the data stored about you (Art. 15)," },
          { label: "Rectification", text: "of inaccurate data (Art. 16)," },
          { label: "Erasure", text: "of your data (Art. 17)," },
          { label: "Restriction", text: "of processing (Art. 18)," },
          { label: "Data portability", text: "(Art. 20)," },
          { label: "Objection", text: "to processing based on our legitimate interests (Art. 21)," },
          { label: "Withdrawal", text: "of consent given, with effect for the future (Art. 7(3))." },
        ] },
        { p: `An email to ${E} is sufficient for your request. You can also change or delete many details directly in the app.` },
        { p: "You also have the right to lodge a complaint with a data protection supervisory authority, in particular in the EU Member State where you live or work (Art. 77 GDPR)." },
      ],
    },
    {
      id: "sicherheit",
      title: "20. Security",
      blocks: [
        { p: "All connections to the app are encrypted. Access to data is restricted on the server by access rules, so users can only see and change the data they are authorised to. However, no online service can guarantee complete protection." },
      ],
    },
    {
      id: "aenderungen",
      title: "21. Changes",
      blocks: [
        { p: "We update this Privacy Policy when the app or the data processing changes. The version published here applies." },
      ],
    },
  ],
};

export const PRIVACY_POLICY: Record<PrivacyLang, PrivacyDoc> = { de, en };
