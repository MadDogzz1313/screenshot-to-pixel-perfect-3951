import { useState } from "react";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useInvalidate } from "@/lib/social";
import { confirmStripeDonation, euro, useAdminStripeDonations } from "@/lib/payments";

/** Adminbereich: bezahlte Stripe-Spenden; „Als geprüft markieren“ ändert nur den internen Prüfstatus und vergibt keine Abzeichen. */
export function StripeDonationsAdmin() {
  const { profiles } = useStore();
  const list = useAdminStripeDonations(true);
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState<string | null>(null);
  const name = (id: string) => profiles.find((p) => p.id === id)?.username ?? `${id.slice(0, 8)}…`;
  const open = list.data?.filter((d) => d.credit_status !== "credited") ?? [];
  const done = list.data?.filter((d) => d.credit_status === "credited").slice(0, 10) ?? [];
  const confirm = async (sid: string) => {
    setBusy(sid);
    try { await confirmStripeDonation(sid); toast.success("Spende als geprüft markiert"); }
    catch (e) { toast.error((e as Error).message); }
    setBusy(null); await invalidate("stripe-donations");
  };
  const row = (d: (typeof open)[number], action: boolean) => (
    <div key={d.session_id} data-testid={`admin-stripe-donation-${d.session_id}`} className="flex items-center justify-between gap-2 rounded-xl border border-border p-2 text-sm">
      <span className="min-w-0"><span className="block truncate font-semibold">{name(d.user_id)} · {euro(d.amount_cents)}</span>
        <span className="block text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}{d.credit_status === "credited" ? " · bestätigt" : ""}</span></span>
      {action && <Button size="sm" data-testid={`admin-stripe-donation-confirm-${d.session_id}`} disabled={busy === d.session_id} onClick={() => void confirm(d.session_id)}>Als geprüft markieren</Button>}
    </div>);
  return (
    <section data-testid="admin-stripe-donations" className="neon-card space-y-2 p-3">
      <p className="flex items-center gap-2 font-display"><CreditCard className="h-4 w-4 text-neon" />Stripe-Spenden ({open.length} offen)</p>
      <p className="text-xs text-muted-foreground">Bezahlte Online-Spenden. „Als geprüft markieren“ setzt nur den internen Prüfstatus.</p>
      {list.isError && <p data-testid="admin-stripe-donations-error" className="text-xs text-destructive">{(list.error as Error).message}</p>}
      {open.map((d) => row(d, true))}
      {list.isSuccess && open.length === 0 && <p data-testid="admin-stripe-donations-empty" className="text-xs text-muted-foreground">Keine offenen Stripe-Spenden.</p>}
      {done.length > 0 && <p className="pt-1 text-[11px] font-bold tracking-[0.2em] text-muted-foreground">ZULETZT BESTÄTIGT</p>}
      {done.map((d) => row(d, false))}
    </section>
  );
}
