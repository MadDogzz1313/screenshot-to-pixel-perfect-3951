import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, OPERATOR } from "@/components/LegalPage";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({ meta: [{ title: "Datenschutz · Leonida Explorer" }, { name: "description", content: "Deutschsprachige Datenschutzerklärung für Leonida Explorer." }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Datenschutz" testId="privacy-page">
      <p data-testid="privacy-intro" className="rounded-2xl border border-accent/40 bg-accent/10 p-3 text-sm">
        Diese Datenschutzerklärung beschreibt die Datenverarbeitungen, die in Leonida Explorer tatsächlich vorgesehen sind. Angaben, die der Betreiber noch ergänzen oder rechtlich prüfen muss, sind deutlich mit <b>BITTE ERGÄNZEN</b> oder <b>BITTE PRÜFEN</b> gekennzeichnet. Diese Seite ist öffentlich und ohne Anmeldung unter <b>/datenschutz</b> erreichbar.
      </p>

      <section data-testid="privacy-controller-section" className="space-y-2">
        <h2 data-testid="privacy-controller-heading">1. Verantwortlicher und Kontakt</h2>
        <p data-testid="privacy-controller-details">Verantwortlicher: {OPERATOR.name}</p>
        <p data-testid="privacy-controller-address">Anschrift: {OPERATOR.address}</p>
        <p data-testid="privacy-controller-email">E-Mail: {OPERATOR.email}</p>
        <p data-testid="privacy-controller-missing" className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs"><b>BITTE ERGÄNZEN:</b> Name, vollständige ladungsfähige Anschrift und eine tatsächlich erreichbare Datenschutz-Kontaktadresse in <code>src/components/LegalPage.tsx</code>.</p>
      </section>

      <section data-testid="privacy-scope-section" className="space-y-2">
        <h2 data-testid="privacy-scope-heading">2. Für welche Angebote gilt diese Erklärung?</h2>
        <p data-testid="privacy-scope-text">Sie gilt für die Leonida-Explorer-Website, die installierbare Home-Bildschirm-App und die iPhone-App. Leonida Explorer ist eine Community-Karte mit Benutzerkonten, Fundort-Beiträgen, Chats und dem Crew Finder.</p>
      </section>

      <section data-testid="privacy-account-section" className="space-y-2">
        <h2 data-testid="privacy-account-heading">3. Registrierung, Anmeldung und Passwort</h2>
        <ul data-testid="privacy-account-list">
          <li data-testid="privacy-account-email"><b>Konto:</b> Bei Registrierung und Anmeldung wird deine E-Mail-Adresse verarbeitet. Supabase Auth verwaltet die Anmeldung und die E-Mail-Bestätigung.</li>
          <li data-testid="privacy-account-password"><b>Passwort:</b> Das Passwort wird an Supabase Auth übermittelt und nicht als Klartext in der App gespeichert. Die App bietet auch Passwort-Zurücksetzung und Passwortänderung an.</li>
          <li data-testid="privacy-account-username"><b>Benutzername:</b> Bei der Registrierung wird der von dir gewählte Benutzername im Profil gespeichert und in den Community-Funktionen angezeigt.</li>
          <li data-testid="privacy-account-session"><b>Anmeldesitzung:</b> Die App benötigt eine Supabase-Anmeldesitzung, damit geschützte Bereiche und Aktionen funktionieren. <b>BITTE PRÜFEN:</b> Die konkrete technische Speicherdauer dieser Sitzung ist in dieser Erklärung noch nicht dokumentiert.</li>
        </ul>
      </section>

      <section data-testid="privacy-profile-section" className="space-y-2">
        <h2 data-testid="privacy-profile-heading">4. Benutzerprofile und Abzeichen</h2>
        <p data-testid="privacy-profile-text">Im Profil können Benutzername, Biografie, Profilbild, Beitrittsdatum, XP, Abzeichen und Privatsphäre-Einstellungen verarbeitet werden. Dazu gehören Einstellungen dafür, ob Profilbild, Beitrittsdatum, Abzeichen, Freundesliste und bestimmte Profilinformationen für andere sichtbar sind.</p>
        <p data-testid="privacy-profile-visibility">Die App verwendet eine geschützte Supabase-Ansicht und Datenbankregeln, um private Profilinformationen nur berechtigten Personen anzuzeigen. <b>BITTE PRÜFEN:</b> Die konkrete Wirksamkeit der Konfiguration sollte im Lovable-Supabase-Projekt kontrolliert werden.</p>
      </section>

      <section data-testid="privacy-spots-section" className="space-y-2">
        <h2 data-testid="privacy-spots-heading">5. Fundort-Beiträge und Bilder</h2>
        <ul data-testid="privacy-spots-list">
          <li data-testid="privacy-spots-content"><b>Fundort:</b> Beim Einreichen werden unter anderem Titel, Kategorie, Gebiet, Kartenposition, optionale Fahrzeug- und Zeitangaben, Beschreibung, Ersteller-ID, Status, Erstellzeitpunkt und Likes verarbeitet.</li>
          <li data-testid="privacy-spots-photos"><b>Fotos:</b> Hochgeladene Fundort-Fotos werden in Supabase Storage gespeichert und dem jeweiligen Beitrag zugeordnet. Beiträge können vor der Freigabe geprüft werden; abgelehnte Fotos werden nicht als freigegebene Inhalte angezeigt.</li>
          <li data-testid="privacy-spots-profile-link"><b>Zuordnung:</b> Freigegebene Beiträge zeigen den öffentlichen Benutzernamen des Erstellers, soweit ein solcher vorhanden und sichtbar ist.</li>
          <li data-testid="privacy-spots-avatar"><b>Profilbilder:</b> Profilbilder werden separat in Supabase Storage gespeichert. Die App verwendet dafür signierte URLs und Privatsphäre-Einstellungen.</li>
        </ul>
      </section>

      <section data-testid="privacy-community-section" className="space-y-2">
        <h2 data-testid="privacy-community-heading">6. Community-Chat</h2>
        <p data-testid="privacy-community-text">Im Community-Chat werden Nachrichten, Benutzerzuordnung, Erstellzeitpunkt und optional ein verknüpfter freigegebener Fundort verarbeitet. Für den Live-Chat verwendet die App Supabase Realtime. Meldungen, Blockierungen, Moderationsmaßnahmen und zeitweise Chat-Einschränkungen können ebenfalls gespeichert werden. Admins können gemeldete Inhalte zur Moderation einsehen.</p>
      </section>

      <section data-testid="privacy-direct-messages-section" className="space-y-2">
        <h2 data-testid="privacy-direct-messages-heading">7. Direktnachrichten und Freunde</h2>
        <p data-testid="privacy-direct-messages-text">Direktnachrichten können zwischen bestätigten Freunden ausgetauscht werden. Verarbeitet werden Absender, Empfänger, Nachrichtentext, Erstellzeitpunkt, Lesestatus und – wenn eine Nachricht gelöscht wurde – der Löschstatus. Freundschaften, Anfragen, Blockierungen, Meldungen und Benachrichtigungen werden für die jeweiligen Funktionen gespeichert. Der Zugriff wird durch Supabase Row Level Security und Datenbankfunktionen beschränkt.</p>
      </section>

      <section data-testid="privacy-crew-section" className="space-y-2">
        <h2 data-testid="privacy-crew-heading">8. Crew Finder</h2>
        <p data-testid="privacy-crew-text">Der Crew Finder verarbeitet für eine Suche unter anderem Aktivität, Plattform, Sprache, Headset-Anforderung, maximale Spielerzahl, externe Mitspieler, Beschreibung und geplanten Start. Zusätzlich werden Leader, Mitglieder, Beitrittsanfragen, Bereitschaftsstatus, Crew-Nachrichten, Status, Erstellzeitpunkt und Ablaufzeit gespeichert. Crew-Nachrichten sind für Mitglieder der jeweiligen Crew vorgesehen. Crew-Suchen und Nutzer können gemeldet und durch Admins moderiert werden.</p>
      </section>

      <section data-testid="privacy-push-section" className="space-y-2">
        <h2 data-testid="privacy-push-heading">9. Push-Mitteilungen (nur bei Aktivierung)</h2>
        <p data-testid="privacy-push-text">Wenn du Push-Mitteilungen aktivierst, speichert die App die für dein Gerät erforderliche Web-Push-Subscription oder – in der iPhone-App – das Apple-Push-Gerätetoken. Zusätzlich werden deine Push-Einstellungen gespeichert. Du kannst Push-Mitteilungen im Profil deaktivieren; beim Abmelden wird das Gerät vom Konto gelöst.</p>
      </section>

      <section data-testid="privacy-payments-section" className="space-y-2">
        <h2 data-testid="privacy-payments-heading">10. Spenden über Stripe</h2>
        <p data-testid="privacy-payments-text">Die App bietet auf der Website Spenden im Stripe-Testmodus beziehungsweise nach Aktivierung des Stripe-Kontos an. Für eine Zahlung werden eine Zahlungs-Sitzungs-ID, die Nutzer-ID, Betrag, Währung, Zahlungsstatus und Zeitpunkte im App-Backend gespeichert. Die eigentliche Zahlungsabwicklung erfolgt durch Stripe. Eine bezahlte Spende wird erst nach Admin-Bestätigung als Spende in Supabase eingetragen und kann dann ein Unterstützer-Abzeichen auslösen.</p>
        <p data-testid="privacy-payments-missing" className="text-xs text-muted-foreground"><b>BITTE ERGÄNZEN/PRÜFEN:</b> Die vollständigen Stripe-Unternehmensangaben, Zahlungsdienstleister-Details, Steuerinformationen und Aufbewahrungsfristen müssen vor Live-Zahlungen rechtlich geprüft und ergänzt werden.</p>
      </section>

      <section data-testid="privacy-purposes-section" className="space-y-2">
        <h2 data-testid="privacy-purposes-heading">11. Zwecke der Verarbeitung</h2>
        <p data-testid="privacy-purposes-text">Die Daten werden verwendet, um Konto und Anmeldung bereitzustellen, Profile und Fundorte anzuzeigen, Beiträge und Bilder zu prüfen, Chats und Crews zu ermöglichen, Missbrauch zu melden und zu moderieren, Abzeichen und Fortschritte zu verwalten, Push-Mitteilungen nach Aktivierung zu senden und – falls genutzt – Spenden abzuwickeln.</p>
        <p data-testid="privacy-legal-bases-missing" className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs"><b>BITTE PRÜFEN UND ERGÄNZEN:</b> Die konkrete Rechtsgrundlage je Verarbeitungszweck wurde nicht vorgegeben und wird hier deshalb nicht erfunden. Bitte lasse insbesondere Rechtsgrundlagen für Konto, Community-Inhalte, Moderation, Push-Mitteilungen und Stripe-Zahlungen fachlich festlegen.</p>
      </section>

      <section data-testid="privacy-providers-section" className="space-y-2">
        <h2 data-testid="privacy-providers-heading">12. Backend, Hosting und Empfänger</h2>
        <ul data-testid="privacy-providers-list">
          <li data-testid="privacy-provider-supabase"><b>Supabase / Lovable Cloud:</b> Authentifizierung, PostgreSQL-Datenbank, Row Level Security, Storage und Realtime werden für die App verwendet.</li>
          <li data-testid="privacy-provider-emergent"><b>Emergent:</b> Die öffentlich ausgelieferte App und der technische App-Backend-Dienst werden über die Emergent-Bereitstellung betrieben.</li>
          <li data-testid="privacy-provider-stripe"><b>Stripe:</b> Bei einer Spende verarbeitet Stripe die Zahlungsdaten und den Zahlungsstatus. Stripe erhält nur die Daten, die für die Zahlungsabwicklung erforderlich sind.</li>
          <li data-testid="privacy-provider-push"><b>Push-Dienste:</b> Bei aktivierten Push-Mitteilungen können Apple, Google oder Mozilla an der Zustellung beteiligt sein.</li>
        </ul>
        <p data-testid="privacy-hosting-missing" className="text-xs text-muted-foreground"><b>BITTE ERGÄNZEN/PRÜFEN:</b> Ergänze die vollständigen Firmennamen, Länder, Auftragsverarbeitungsverträge, Drittlandübermittlungen und die jeweils maßgeblichen Hosting- und Dienstleisterangaben. Diese Erklärung nennt nur die im Projekt erkennbaren technischen Dienste.</p>
      </section>

      <section data-testid="privacy-retention-section" className="space-y-2">
        <h2 data-testid="privacy-retention-heading">13. Speicherdauer und Löschung</h2>
        <p data-testid="privacy-retention-account">Du kannst dein Konto in der App unter Profil → „Konto löschen“ löschen. Der implementierte Löschvorgang entfernt das Konto sowie zugehörige Profile, Fundort-Fotos, Avatare, Nachrichten, Freundschaften und Push-Geräte, soweit die Datenbankbeziehungen und Speicherberechtigungen dies zulassen.</p>
        <p data-testid="privacy-retention-missing" className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs"><b>BITTE ERGÄNZEN:</b> Konkrete Speicherdauern für Konten, Beiträge, Bilder, Chat- und Direktnachrichten, Moderationsdaten, Zahlungsdaten, Backups und gesetzliche Aufbewahrungspflichten sind noch nicht festgelegt. Bitte trage für jede Datenkategorie eine geprüfte Frist ein.</p>
      </section>

      <section data-testid="privacy-rights-section" className="space-y-2">
        <h2 data-testid="privacy-rights-heading">14. Deine Datenschutzrechte</h2>
        <p data-testid="privacy-rights-missing" className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs"><b>BITTE PRÜFEN UND ERGÄNZEN:</b> Die zuständige Datenschutzaufsichtsbehörde, die Bearbeitungswege für Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch sowie die konkrete Kontaktadresse müssen vom Betreiber ergänzt werden. Bitte lasse außerdem prüfen, welche Rechte und Fristen im Einzelfall gelten.</p>
        <p data-testid="privacy-rights-contact">Bis zur Ergänzung ist als Kontakt nur die oben angezeigte Betreiber-E-Mail vorgesehen: {OPERATOR.email}</p>
      </section>

      <section data-testid="privacy-cookies-section" className="space-y-2">
        <h2 data-testid="privacy-cookies-heading">15. Lokale Speicherung</h2>
        <p data-testid="privacy-cookies-text">Die App speichert bestimmte Komfort- und Geräteeinstellungen lokal, darunter die Merkliste, Gaststatus, Push-Ziel und einzelne Anzeigeeinstellungen. <b>BITTE PRÜFEN:</b> Eine vollständige technische Liste aller Browser-, Web-App- und iPhone-Speicher sowie eine mögliche Cookie-Erklärung muss vor der Veröffentlichung rechtlich und technisch ergänzt werden.</p>
      </section>

      <section data-testid="privacy-updates-section" className="space-y-2">
        <h2 data-testid="privacy-updates-heading">16. Änderungen dieser Erklärung</h2>
        <p data-testid="privacy-updates-text">Wenn sich Funktionen oder Datenverarbeitungen ändern, muss diese Erklärung aktualisiert werden. <b>BITTE ERGÄNZEN:</b> Prüfe vor jeder Veröffentlichung den Stand, die Änderungsnotiz und das Datum.</p>
      </section>
    </LegalPage>
  );
}
