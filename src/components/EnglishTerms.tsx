import { OPERATOR } from "@/components/LegalPage";

/** Englische Übersetzung der aktuell geltenden deutschen Nutzungsbedingungen. */
export function EnglishTerms() {
  return (
    <div data-testid="terms-english" className="space-y-4">
      <header data-testid="terms-english-header" className="space-y-1"><h1 className="font-display text-xl">Terms of Use</h1><p>These terms apply to the use of Leonida Explorer (website, Home Screen app, and iPhone app). Operator: {OPERATOR.name}, contact: {OPERATOR.email}.</p></header>
      <section data-testid="terms-english-fan-project"><h2>1. Fan Project</h2><p>Leonida Explorer is an unofficial community project created by fans. It is not affiliated with, supported by, or reviewed by Rockstar Games or Take-Two Interactive. All trademarks belong to their respective owners.</p></section>
      <section data-testid="terms-english-account"><h2>2. Account</h2><p>You need an account for submissions, chats, and friendships. You are responsible for your access credentials. You may delete your account at any time under Profile → “Delete account”.</p></section>
      <section data-testid="terms-english-community-rules"><h2>3. Community Rules – Zero Tolerance</h2><p>There is <b>zero tolerance for objectionable content or abusive behavior</b>. The following are prohibited in particular:</p><ul><li>Insults, harassment, bullying, threats, and hate speech</li><li>Sexual, glorifying-violence, or otherwise objectionable content</li><li>Spam, advertising, fraud, and sharing other people’s personal data</li><li>Illegal content and copyright infringements</li></ul></section>
      <section data-testid="terms-english-moderation"><h2>4. Reporting, Blocking, and Moderation</h2><p>You can report users and messages and block users at any time. Blocked users can no longer message you. The admin team reviews reports within 24 hours, removes impermissible content, and bans users who violate these rules, temporarily or permanently depending on the severity.</p></section>
      <section data-testid="terms-english-content"><h2>5. Your Content</h2><p>You are responsible for your spots, photos, and messages. By uploading them, you allow us to display them in the App. New spots are published only after review by the admin team.</p></section>
      <section data-testid="terms-english-liability"><h2>6. Liability and Changes</h2><p>Map information comes from the community and may be inaccurate. We may amend these terms; we will notify users in the App about material changes.</p></section>
    </div>
  );
}
