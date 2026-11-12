import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { PrivacyPolicy } from "@/components/PrivacyPolicy";
import { EnglishPrivacyPolicy } from "@/components/EnglishPrivacyPolicy";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({ meta: [{ title: "Datenschutz · Leonida Explorer" }, { name: "description", content: "Datenschutzerklärung von Leonida Explorer: welche Daten verarbeitet werden, wie lange sie gespeichert werden und welche Rechte du hast." }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage title="Datenschutz" testId="privacy-page" englishChildren={<EnglishPrivacyPolicy />}>
      <PrivacyPolicy lang="de" />
    </LegalPage>
  );
}
