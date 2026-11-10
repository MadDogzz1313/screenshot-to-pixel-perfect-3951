import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, OPERATOR } from "@/components/LegalPage";

export const Route = createFileRoute("/nutzungsbedingungen")({
  head: () => ({ meta: [{ title: "Nutzungsbedingungen · Leonida Explorer" }, { name: "description", content: "Nutzungsbedingungen und Community-Regeln von Leonida Explorer." }] }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Nutzungsbedingungen" testId="terms-page">
      <p>Diese Bedingungen gelten für die Nutzung von Leonida Explorer (Website, Home-Bildschirm-App und iPhone-App). Betreiber: {OPERATOR.name}, {OPERATOR.address}, {OPERATOR.email}.</p>
      <h2>1. Fan-Projekt</h2>
      <p>Leonida Explorer ist ein inoffizielles Community-Projekt von Fans. Es steht in keiner Verbindung zu Rockstar Games oder Take-Two Interactive und wird von diesen weder unterstützt noch geprüft. Alle Marken gehören ihren jeweiligen Inhabern.</p>
      <h2>2. Konto</h2>
      <p>Für Beiträge, Chats und Freundschaften brauchst du ein Konto. Du bist für deine Zugangsdaten verantwortlich. Du kannst dein Konto jederzeit unter Profil → „Konto löschen“ selbst löschen.</p>
      <h2>3. Community-Regeln – keine Toleranz</h2>
      <p>Es gibt <b>keine Toleranz für anstößige Inhalte oder missbräuchliches Verhalten</b>. Verboten sind insbesondere:</p>
      <ul>
        <li>Beleidigungen, Belästigung, Mobbing, Drohungen und Hassrede</li>
        <li>sexuelle, gewaltverherrlichende oder sonst anstößige Inhalte</li>
        <li>Spam, Werbung, Betrug und das Teilen persönlicher Daten anderer</li>
        <li>rechtswidrige Inhalte und Urheberrechtsverletzungen</li>
      </ul>
      <h2>4. Melden, Blockieren, Moderation</h2>
      <p>Du kannst Nutzer und Nachrichten jederzeit melden und Nutzer blockieren. Blockierte Nutzer können dir nicht mehr schreiben. Das Admin-Team prüft Meldungen innerhalb von 24 Stunden, entfernt unzulässige Inhalte und sperrt Nutzer, die gegen diese Regeln verstoßen – je nach Schwere vorübergehend oder dauerhaft.</p>
      <h2>5. Deine Inhalte</h2>
      <p>Du bist für deine Fundorte, Fotos und Nachrichten verantwortlich. Mit dem Hochladen erlaubst du uns, sie in der App anzuzeigen. Neue Fundorte werden erst nach Prüfung durch das Admin-Team veröffentlicht.</p>
      <h2>6. Haftung und Änderungen</h2>
      <p>Die Angaben in der Karte stammen aus der Community und können ungenau sein. Wir können diese Bedingungen anpassen; über wesentliche Änderungen informieren wir in der App.</p>
    </LegalPage>
  );
}
