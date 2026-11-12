import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, OPERATOR } from "@/components/LegalPage";
import { EnglishPrivacyPolicy } from "@/components/EnglishPrivacyPolicy";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({ meta: [{ title: "Datenschutz · Leonida Explorer" }, { name: "description", content: "Deutschsprachige Datenschutzerklärung für Leonida Explorer." }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Datenschutz" testId="privacy-page" englishChildren={<EnglishPrivacyPolicy />}>
      <p data-testid="privacy-intro">Diese Datenschutzerklärung beschreibt, welche personenbezogenen Daten die unabhängig entwickelte Community- und Begleit-App Leonida Explorer für Fans von GTA VI verarbeitet, wofür, wie lange und welche Rechte du hast. Die Seite ist ohne Anmeldung öffentlich unter <b>/datenschutz</b> erreichbar.</p>

      <section data-testid="privacy-controller-section" className="space-y-2">
        <h2 data-testid="privacy-controller-heading">1. Verantwortlicher und Kontakt</h2>
        <p data-testid="privacy-controller-details">Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO): {OPERATOR.name}</p>
        <p data-testid="privacy-controller-email">Datenschutzkontakt: {OPERATOR.email}</p>
        <p data-testid="privacy-controller-dpo">Ein Datenschutzbeauftragter ist nicht benannt.</p>
      </section>

      <section data-testid="privacy-scope-section" className="space-y-2">
        <h2 data-testid="privacy-scope-heading">2. Für welche Angebote gilt diese Erklärung?</h2>
        <p data-testid="privacy-scope-text">Sie gilt für die Leonida-Explorer-Website, die installierbare Home-Bildschirm-App und die iPhone-App. Leonida Explorer ist eine Community-Karte mit Benutzerkonten, Fundort-Beiträgen, Community-Chat, Privatnachrichten, Crew Finder und Minispielen.</p>
      </section>

      <section data-testid="privacy-account-section" className="space-y-2">
        <h2 data-testid="privacy-account-heading">3. Registrierung, Anmeldung und Passwort</h2>
        <ul data-testid="privacy-account-list">
          <li data-testid="privacy-account-email"><b>Konto:</b> Bei Registrierung und Anmeldung werden deine E-Mail-Adresse und eine zufällige Konto-ID verarbeitet. Supabase Auth verwaltet die Anmeldung und den Versand der Bestätigungs- und Passwort-E-Mails.</li>
          <li data-testid="privacy-account-password"><b>Passwort:</b> Das Passwort wird verschlüsselt (HTTPS) an Supabase Auth übertragen und dort nur als Hashwert gespeichert, nie im Klartext in der App.</li>
          <li data-testid="privacy-account-username"><b>Benutzername:</b> Der von dir gewählte Benutzername wird im Profil gespeichert und in den Community-Funktionen angezeigt.</li>
          <li data-testid="privacy-account-session"><b>Anmeldesitzung:</b> Damit du angemeldet bleibst, speichert die App eine Supabase-Anmeldesitzung im Speicher des Browsers bzw. der App. Sie wird beim Abmelden entfernt.</li>
          <li data-testid="privacy-account-required"><b>Pflichtangaben:</b> E-Mail-Adresse, Passwort und Benutzername sind für ein Konto erforderlich. Ohne sie kann kein Konto angelegt werden; die Karte ist teilweise auch ohne Konto nutzbar.</li>
        </ul>
      </section>

      <section data-testid="privacy-profile-section" className="space-y-2">
        <h2 data-testid="privacy-profile-heading">4. Benutzerprofile, Level und Abzeichen</h2>
        <p data-testid="privacy-profile-text">Im Profil werden Benutzername, Biografie, Profilbild, Beitrittsdatum, XP, Level, Abzeichen, aktive Tage und deine Privatsphäre-Einstellungen gespeichert. Du entscheidest, ob Profilbild, Beitrittsdatum, Abzeichen und Freundesliste für andere sichtbar sind oder ob dein Profil privat ist.</p>
        <p data-testid="privacy-profile-visibility">Öffentliche Profilangaben (z. B. Benutzername) können auch ohne Anmeldung abgerufen werden. Private Angaben werden über eine geschützte Datenbank-Ansicht und Datenbankregeln (Row Level Security) nur berechtigten Personen angezeigt. Profilbilder liegen in einem nicht öffentlichen Speicherbereich und werden nur über zeitlich begrenzte Links ausgeliefert.</p>
      </section>

      <section data-testid="privacy-spots-section" className="space-y-2">
        <h2 data-testid="privacy-spots-heading">5. Fundort-Beiträge und Bilder</h2>
        <ul data-testid="privacy-spots-list">
          <li data-testid="privacy-spots-content"><b>Fundort:</b> Beim Einreichen werden Titel, Kategorie, Gebiet, Kartenposition, optionale Fahrzeug- und Zeitangaben, Beschreibung, deine Konto-ID, Status, Erstellzeitpunkt und Likes gespeichert. Neue Fundorte werden erst nach Prüfung durch einen Admin öffentlich.</li>
          <li data-testid="privacy-spots-photos"><b>Fotos:</b> Fundort-Fotos werden in Supabase Storage gespeichert. Bestätigte Fotos freigegebener Fundorte sind öffentlich abrufbar; die Dateiliste ist nur für eigene Dateien, Admins und freigegebene Fotos einsehbar.</li>
          <li data-testid="privacy-spots-profile-link"><b>Zuordnung:</b> Freigegebene Fundorte zeigen den Benutzernamen des Erstellers.</li>
        </ul>
      </section>

      <section data-testid="privacy-community-section" className="space-y-2">
        <h2 data-testid="privacy-community-heading">6. Community-Chat</h2>
        <p data-testid="privacy-community-text">Im Community-Chat werden Nachrichtentext, Absender, Zeitpunkt und optional ein verknüpfter freigegebener Fundort gespeichert. Der Chat ist nur für angemeldete Nutzer lesbar; neue Nachrichten werden live über Supabase Realtime übertragen. Zwischen Nutzern, von denen einer den anderen blockiert hat, werden die Nachrichten beidseitig ausgeblendet. Löschst du eine eigene Nachricht (oder entfernt ein Admin sie), wird der Text sofort aus der Datenbank entfernt.</p>
      </section>

      <section data-testid="privacy-direct-messages-section" className="space-y-2">
        <h2 data-testid="privacy-direct-messages-heading">7. Privatnachrichten und Freunde</h2>
        <p data-testid="privacy-direct-messages-text">Privatnachrichten sind nur zwischen bestätigten Freunden möglich. Gespeichert werden Absender, Empfänger, Nachrichtentext, Zeitpunkt, Lesestatus und gegebenenfalls der Löschzeitpunkt. Datenbankregeln (Row Level Security) sorgen dafür, dass nur die beiden Gesprächsteilnehmer die Nachrichten abrufen können – auch Admins haben in der App keinen Zugriff. Nur wenn der Empfänger eine Nachricht meldet, wird der Text genau dieser einen Nachricht in die Meldung übernommen und für Admins sichtbar.</p>
        <p data-testid="privacy-direct-messages-encryption">Die Übertragung ist per HTTPS verschlüsselt. Privatnachrichten sind <b>nicht Ende-zu-Ende-verschlüsselt</b>: Sie liegen in der Supabase-Datenbank und wären technisch für Personen mit direktem Datenbankzugang (Betreiber, Auftragsverarbeiter) einsehbar. Teile daher keine sensiblen Daten im Chat.</p>
        <p data-testid="privacy-friends-text">Für Freundschaften werden Anfragen, deren Status und die bestehenden Freundschaften gespeichert. Die Glocke speichert Benachrichtigungen (z. B. neue Anfrage, neue Nachricht) mit auslösendem Nutzer und Lesestatus.</p>
      </section>

      <section data-testid="privacy-moderation-section" className="space-y-2">
        <h2 data-testid="privacy-moderation-heading">8. Melden, Blockieren und Moderation</h2>
        <ul data-testid="privacy-moderation-list">
          <li data-testid="privacy-moderation-report"><b>Melden:</b> Du kannst Nutzer, Chat- und Privatnachrichten sowie Crew-Suchen melden. Gespeichert werden Melder, gemeldete Person, Grund, deine optionale Beschreibung, bei Nachrichten der gemeldete Text sowie Bearbeitungsstatus und Admin-Notiz. Meldungen sind nur für Admins einsehbar; die gemeldete Person erfährt nicht, wer sie gemeldet hat.</li>
          <li data-testid="privacy-moderation-block"><b>Blockieren:</b> Wer blockiert wird, kann dir keine Privatnachrichten und keine Freundschaftsanfragen mehr senden; eine bestehende Freundschaft wird beendet und eure Community-Chat-Nachrichten werden gegenseitig ausgeblendet. Die Blockierung wird gespeichert, bis du sie aufhebst. Die blockierte Person sieht nicht, dass bzw. von wem sie blockiert wurde.</li>
          <li data-testid="privacy-moderation-admin"><b>Moderation:</b> Admins können gemeldete Inhalte prüfen und entfernen sowie Nutzer verwarnen, stummschalten oder sperren. Diese Maßnahmen werden mit Grund und Zeitpunkt in einem Moderationsprotokoll gespeichert. Es findet keine automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO statt; technische Begrenzungen (z. B. maximale Nachrichten pro Minute) dienen nur dem Spam-Schutz.</li>
        </ul>
      </section>

      <section data-testid="privacy-crew-section" className="space-y-2">
        <h2 data-testid="privacy-crew-heading">9. Crew Finder</h2>
        <p data-testid="privacy-crew-text">Für eine Crew-Suche werden Aktivität, Plattform, Sprache, Headset-Anforderung, Spielerzahl, Beschreibung und geplanter Start gespeichert, außerdem Leader, Mitglieder, Beitrittsanfragen, Bereitschaftsstatus und Crew-Nachrichten. Crew-Nachrichten sind nur für Mitglieder der jeweiligen Crew lesbar. Abgelaufene Suchen werden automatisch entfernt, sobald sie länger als sieben Tage abgelaufen sind und eine neue Suche angelegt wird.</p>
      </section>

      <section data-testid="privacy-arcade-section" className="space-y-2">
        <h2 data-testid="privacy-arcade-heading">10. Neon Arcade und Bestenlisten</h2>
        <p data-testid="privacy-arcade-text">Bei den Minispielen werden Spielrunden, Punktestände, Ranglistenposition, Arcade-XP, Coins, freigeschaltete Fundorte und deine Konto-ID gespeichert. In Bestenlisten erscheint dein Benutzername. Die Spiele laufen lokal auf deinem Gerät; Analyse- oder Werbe-SDKs werden nicht eingesetzt.</p>
      </section>

      <section data-testid="privacy-push-section" className="space-y-2">
        <h2 data-testid="privacy-push-heading">11. Push-Mitteilungen (nur mit deiner Einwilligung)</h2>
        <p data-testid="privacy-push-text">Wenn du Push-Mitteilungen aktivierst, speichert die App die Web-Push-Adresse deines Browsers bzw. in der iPhone-App das Apple-Push-Gerätetoken sowie deine Push-Einstellungen. Die Zustellung erfolgt über den Push-Dienst deines Browsers bzw. Apple Push Notification service (APNs). Eine Nachrichtenvorschau wird nur gesendet, wenn du sie einschaltest. Du kannst Push jederzeit im Profil oder in den iPhone-Einstellungen deaktivieren; beim Abmelden wird das Gerät vom Konto gelöst.</p>
      </section>

      <section data-testid="privacy-payments-section" className="space-y-2">
        <h2 data-testid="privacy-payments-heading">12. Spenden über Stripe (nur Website)</h2>
        <p data-testid="privacy-payments-text">Auf der Website sind freiwillige Spenden über Stripe möglich. Im App-Backend werden dafür Zahlungs-Sitzungs-ID, Konto-ID, Betrag, Währung, Zahlungsstatus und Zeitpunkte gespeichert. Kartendaten gibst du ausschließlich bei Stripe ein; sie erreichen die App nicht. Eine bezahlte Spende wird nach Admin-Bestätigung in Supabase eingetragen und kann ein Unterstützer-Abzeichen auslösen. In der iPhone-App sind Spenden ausgeblendet.</p>
      </section>

      <section data-testid="privacy-purposes-section" className="space-y-2">
        <h2 data-testid="privacy-purposes-heading">13. Zwecke und Rechtsgrundlagen</h2>
        <ul data-testid="privacy-legal-bases-list">
          <li data-testid="privacy-legal-basis-contract"><b>Art. 6 Abs. 1 lit. b DSGVO (Vertrag/Nutzungsverhältnis):</b> Konto, Anmeldung, Profil, Fundorte, Community-Chat, Privatnachrichten, Freunde, Crew Finder, Minispiele, Abzeichen und Konto-Löschung.</li>
          <li data-testid="privacy-legal-basis-interest"><b>Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse):</b> Sicherheit, Spam- und Missbrauchsschutz, Meldungen, Blockieren, Moderation und Moderationsprotokoll – unser Interesse ist eine sichere, respektvolle Community.</li>
          <li data-testid="privacy-legal-basis-consent"><b>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung):</b> Push-Mitteilungen. Die Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen.</li>
          <li data-testid="privacy-legal-basis-obligation"><b>Art. 6 Abs. 1 lit. c DSGVO (rechtliche Pflicht):</b> Aufbewahrung von Zahlungsunterlagen zu Spenden, soweit gesetzlich vorgeschrieben.</li>
        </ul>
      </section>

      <section data-testid="privacy-providers-section" className="space-y-2">
        <h2 data-testid="privacy-providers-heading">14. Auftragsverarbeiter und Empfänger</h2>
        <ul data-testid="privacy-providers-list">
          <li data-testid="privacy-provider-supabase"><b>Supabase (bereitgestellt über Lovable Cloud):</b> Anmeldung, Datenbank, Datei-Speicher und Live-Übertragung. Supabase verarbeitet diese Daten in unserem Auftrag als Auftragsverarbeiter (Art. 28 DSGVO) und nicht für eigene Zwecke.</li>
          <li data-testid="privacy-provider-emergent"><b>Emergent:</b> Auslieferung der Website/App und Betrieb des technischen App-Backends (Push-Versand, Spendenabwicklung) als Auftragsverarbeiter.</li>
          <li data-testid="privacy-provider-stripe"><b>Stripe:</b> Zahlungsabwicklung bei Spenden; Stripe ist für die Zahlungsdaten teilweise selbst verantwortlich.</li>
          <li data-testid="privacy-provider-push"><b>Push-Dienste:</b> Push-Dienst deines Browsers bzw. Apple (APNs), nur bei aktivierten Push-Mitteilungen.</li>
          <li data-testid="privacy-provider-libraries"><b>Keine Weitergabe zu Werbezwecken:</b> Daten werden nicht verkauft. Analyse-, Tracking- oder Werbedienste werden nicht eingesetzt.</li>
        </ul>
      </section>

      <section data-testid="privacy-transfer-section" className="space-y-2">
        <h2 data-testid="privacy-transfer-heading">15. Drittlandübermittlungen</h2>
        <p data-testid="privacy-transfer-text">Supabase, Lovable, Emergent, Stripe und Apple sitzen teilweise in den USA oder setzen dort Unterauftragnehmer ein. Übermittlungen in Drittländer erfolgen auf Grundlage eines Angemessenheitsbeschlusses (z. B. EU-US Data Privacy Framework, soweit der Anbieter zertifiziert ist) oder der EU-Standardvertragsklauseln der jeweiligen Anbieter.</p>
      </section>

      <section data-testid="privacy-security-section" className="space-y-2">
        <h2 data-testid="privacy-security-heading">16. Sicherheit</h2>
        <p data-testid="privacy-security-text">Alle Verbindungen sind per HTTPS verschlüsselt. Der Zugriff auf Daten wird serverseitig durch Datenbankregeln (Row Level Security) und geprüfte Datenbankfunktionen beschränkt; Schreibzugriffe auf Nachrichten, Meldungen und Sperren sind nur über diese Funktionen möglich. Eine absolute Sicherheit kann kein Onlinedienst garantieren.</p>
      </section>

      <section data-testid="privacy-retention-section" className="space-y-2">
        <h2 data-testid="privacy-retention-heading">17. Speicherdauer</h2>
        <ul data-testid="privacy-retention-list">
          <li data-testid="privacy-retention-account-data"><b>Konto, Profil, XP, Coins, Abzeichen, Freunde, Push-Einstellungen:</b> bis zur Löschung deines Kontos.</li>
          <li data-testid="privacy-retention-messages"><b>Community-Chat- und Privatnachrichten:</b> bis du sie löschst (der Text wird dann sofort entfernt, bei Privatnachrichten bleibt nur ein leerer Platzhalter „Nachricht gelöscht“) oder bis zur Löschung eines der beteiligten Konten.</li>
          <li data-testid="privacy-retention-notifications"><b>Benachrichtigungen der Glocke:</b> bis zur Löschung deines Kontos oder des auslösenden Kontos.</li>
          <li data-testid="privacy-retention-blocks"><b>Blockierungen:</b> bis du sie aufhebst oder eines der Konten gelöscht wird.</li>
          <li data-testid="privacy-retention-reports"><b>Meldungen:</b> bis zur Bearbeitung durch einen Admin und danach noch <b>6 Monate</b>; anschließend werden sie automatisch gelöscht. Meldungen von oder über ein gelöschtes Konto werden mit dem Konto gelöscht.</li>
          <li data-testid="privacy-retention-moderation"><b>Sperren und Moderationsprotokoll:</b> Sperren bis zu ihrem Ablauf bzw. ihrer Aufhebung oder bis zur Kontolöschung. Protokolleinträge bleiben nach einer Kontolöschung ohne Verknüpfung zum gelöschten Konto erhalten.</li>
          <li data-testid="privacy-retention-technical"><b>Technische Spam-Zähler:</b> höchstens 24 Stunden.</li>
          <li data-testid="privacy-retention-payments"><b>Spenden-Unterlagen:</b> so lange gesetzliche Aufbewahrungspflichten bestehen (steuerrechtlich bis zu 10 Jahre), danach werden sie gelöscht.</li>
          <li data-testid="privacy-retention-backups"><b>Sicherungskopien:</b> Gelöschte Daten können in automatischen Datenbank-Sicherungen des Hosters noch bis zu deren turnusmäßiger Überschreibung enthalten sein.</li>
        </ul>
      </section>

      <section data-testid="privacy-deletion-section" className="space-y-2">
        <h2 data-testid="privacy-deletion-heading">18. Konto löschen</h2>
        <p data-testid="privacy-retention-account">Du kannst dein Konto jederzeit selbst unter Profil → „Konto löschen“ löschen. Dabei werden sofort und endgültig gelöscht: Anmeldekonto (E-Mail, Passwort-Hash, Sitzungen), Profil und Profilbild, XP, Coins, Abzeichen, Spielstände, Freundschaften und Anfragen, Blockierungen, deine Community-Chat-Nachrichten, alle Privatgespräche, an denen du beteiligt warst (für beide Seiten), deine Crews und Crew-Nachrichten, Benachrichtigungen, Push-Geräte, Meldungen von dir oder über dich sowie alle noch nicht freigegebenen Fundorte und Fotos.</p>
        <p data-testid="privacy-deletion-anonymized">Bereits freigegebene Fundorte und ihre bestätigten Fotos bleiben als Community-Beitrag auf der Karte, werden aber <b>anonymisiert</b>: Sie zeigen „Gelöschter Nutzer“ und sind keinem Konto mehr zugeordnet. Wenn du auch diese Beiträge entfernt haben möchtest, schreibe vor oder nach der Löschung an {OPERATOR.email}.</p>
        <p data-testid="privacy-deletion-admin">Admin-Konten müssen vor der Löschung ihre Admin-Rolle abgeben. Alternativ kannst du die Löschung per E-Mail an {OPERATOR.email} beantragen.</p>
      </section>

      <section data-testid="privacy-rights-section" className="space-y-2">
        <h2 data-testid="privacy-rights-heading">19. Deine Rechte</h2>
        <p data-testid="privacy-rights-missing">Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3).</p>
        <p data-testid="privacy-rights-contact">Für Anfragen genügt eine E-Mail an {OPERATOR.email}. Viele Angaben kannst du auch direkt in der App ändern oder löschen.</p>
        <p data-testid="privacy-rights-complaint">Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, insbesondere in dem Mitgliedstaat deines Aufenthaltsorts (Art. 77 DSGVO).</p>
      </section>

      <section data-testid="privacy-cookies-section" className="space-y-2">
        <h2 data-testid="privacy-cookies-heading">20. Lokale Speicherung und Cookies</h2>
        <p data-testid="privacy-cookies-text">Die App speichert auf deinem Gerät nur, was für Anmeldung und Bedienung nötig ist: die Supabase-Anmeldesitzung, die gewählte Sprache, eine lokale Merkliste, den Gaststatus, die gewählte Neon-Highway-Kamera, in der iPhone-App das Push-Gerätetoken, kurzzeitig ein internes Push-Ziel (<code>sessionStorage</code>) sowie ein Cookie <code>sidebar_state</code> (sieben Tage) für die Seitenleiste. Es werden keine Analyse- oder Werbe-Cookies verwendet; eine Einwilligung nach § 25 Abs. 2 TDDDG ist dafür nicht erforderlich.</p>
      </section>

      <section data-testid="privacy-technical-section" className="space-y-2">
        <h2 data-testid="privacy-technical-heading">21. Server-Protokolle</h2>
        <p data-testid="privacy-technical-text">Beim Aufruf der App verarbeiten die Server der Hoster technisch notwendige Daten wie IP-Adresse, Zeitpunkt, angefragte Adresse und Browser-/Gerätekennung, um die App auszuliefern und Angriffe abzuwehren (Art. 6 Abs. 1 lit. f DSGVO). Art und Dauer dieser Protokolle bestimmt der jeweilige Hoster.</p>
      </section>

      <section data-testid="privacy-children-section" className="space-y-2">
        <h2 data-testid="privacy-children-heading">22. Kinder</h2>
        <p data-testid="privacy-children-text">Leonida Explorer richtet sich an Nutzer, die das für den Dienst geltende Mindestalter erreicht haben. Wir verarbeiten wissentlich keine Daten von Kindern entgegen den gesetzlichen Vorgaben.</p>
      </section>

      <section data-testid="privacy-updates-section" className="space-y-2">
        <h2 data-testid="privacy-updates-heading">23. Änderungen dieser Erklärung</h2>
        <p data-testid="privacy-updates-text">Wenn sich Funktionen oder Datenverarbeitungen ändern, wird diese Erklärung aktualisiert und mit einem neuen Stand versehen.</p>
      </section>
    </LegalPage>
  );
}
