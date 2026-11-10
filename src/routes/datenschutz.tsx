import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, OPERATOR } from "@/components/LegalPage";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({ meta: [{ title: "Datenschutz · Leonida Explorer" }, { name: "description", content: "Datenschutzerklärung von Leonida Explorer." }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Datenschutz" testId="privacy-page">
      <h2>Verantwortlicher</h2>
      <p>{OPERATOR.name}, {OPERATOR.address}, E-Mail: {OPERATOR.email}</p>
      <h2>Welche Daten wir verarbeiten</h2>
      <ul>
        <li><b>Konto:</b> E-Mail-Adresse, Passwort (nur verschlüsselt gespeichert), Benutzername, Beitrittsdatum.</li>
        <li><b>Profil:</b> Profilbild, Bio, XP, Abzeichen und deine Privatsphäre-Einstellungen.</li>
        <li><b>Inhalte:</b> Fundorte mit Fotos, Likes, Korrekturen, Community- und Privatchat-Nachrichten, Freundschaften, Meldungen und Blockierungen.</li>
        <li><b>Push-Mitteilungen:</b> Gerätekennung für Mitteilungen (Web Push bzw. Apple Push), nur wenn du Push aktivierst.</li>
        <li><b>Nutzung:</b> Tage, an denen du die App geöffnet hast (für Abzeichen). Kein Tracking, keine Werbung.</li>
      </ul>
      <h2>Zweck und Rechtsgrundlage</h2>
      <p>Wir verarbeiten die Daten, um die App bereitzustellen (Art. 6 Abs. 1 lit. b DSGVO) und um die Community vor Missbrauch zu schützen (Art. 6 Abs. 1 lit. f DSGVO). Push-Mitteilungen nur mit deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du jederzeit im Profil widerrufen kannst.</p>
      <h2>Dienstleister</h2>
      <p>Datenbank, Anmeldung und Dateispeicher laufen über Supabase (Lovable Cloud). Die App wird über Emergent bereitgestellt. Push-Mitteilungen werden über Apple, Google oder Mozilla zugestellt. Wir verkaufen keine Daten.</p>
      <h2>Speicherdauer und Löschung</h2>
      <p>Deine Daten bleiben gespeichert, solange dein Konto besteht. Unter Profil → „Konto löschen“ löschst du dein Konto selbst; dabei werden Profil, Fundorte, Fotos, Nachrichten, Freundschaften und Push-Geräte dauerhaft entfernt.</p>
      <h2>Deine Rechte</h2>
      <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch sowie auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde. Schreib uns dazu an {OPERATOR.email}.</p>
    </LegalPage>
  );
}
