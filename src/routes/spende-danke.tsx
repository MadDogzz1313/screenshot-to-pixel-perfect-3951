import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { usePaymentStatus } from "@/lib/payments";

export const Route = createFileRoute("/spende-danke")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string } => (typeof s["session_id"] === "string" ? { session_id: s["session_id"] } : {}),
  head: () => ({ meta: [{ title: "Danke · Leonida Explorer" }, { name: "robots", content: "noindex" }] }),
  component: Thanks,
});

function Thanks() {
  const { session_id } = Route.useSearch();
  const st = usePaymentStatus(session_id);
  const [startedAt] = useState(() => Date.now());
  const ps = st.data?.payment_status;
  const paid = ps === "paid";
  const failed = st.isError || !session_id || ps === "expired" || ps === "failed";
  const timedOut = !paid && !failed && !st.isFetching && st.dataUpdatedAt - startedAt > 115_000;
  return (
    <AppShell title="Unterstützen">
      <div data-testid="donate-thanks-page" data-status={ps ?? "loading"} className="neon-card mx-3 space-y-3 p-6 text-center">
        {paid ? <>
          <CheckCircle2 className="mx-auto h-12 w-12 text-neon" />
          <p data-testid="donate-thanks-success" className="font-display text-lg">Danke für deine Spende!</p>
          <p className="text-sm text-muted-foreground">Die Zahlung ist eingegangen. Ein Admin bestätigt sie in Kürze – dann erscheint dein Unterstützer-Abzeichen im Profil.</p>
        </> : failed || timedOut ? <>
          <XCircle className="mx-auto h-12 w-12 text-destructive" />
          <p data-testid="donate-thanks-failed" className="font-display text-lg">{timedOut ? "Zahlung wird noch geprüft" : "Zahlung nicht abgeschlossen"}</p>
          <p className="text-sm text-muted-foreground">{timedOut ? "Stripe hat noch keine Bestätigung gesendet. Schau später im Profil nach deinem Abzeichen." : "Es wurde nichts abgebucht. Du kannst es erneut versuchen."}</p>
        </> : <>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-neon" />
          <p data-testid="donate-thanks-pending" className="font-display">Zahlung wird bestätigt …</p>
        </>}
        <div className="flex justify-center gap-2 pt-1">
          <Link to="/profil" data-testid="donate-thanks-profile-link" className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Zum Profil</Link>
          {!paid && <Link to="/spenden" data-testid="donate-thanks-retry-link" className="rounded-full border border-border px-4 py-2 text-sm font-semibold">Erneut versuchen</Link>}
        </div>
      </div>
    </AppShell>
  );
}
