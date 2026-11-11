import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/payments";

/** Spiegel von backend/models/push.py PushServerStatus */
interface PushServerStatus {
  server_url: string; web_keys: boolean; apple_keys: boolean; secret_set: boolean; db_ready: boolean;
  db_configured: boolean; db_url: string | null; db_url_matches: boolean; db_secret_matches: boolean;
}
const KEY = ["push-server-status"];

function Row({ ok, label, hint, testId }: { ok: boolean; label: string; hint?: string | undefined; testId: string }) {
  return (
    <div data-testid={testId} data-ok={ok} className="flex items-start gap-2 text-sm">
      {ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#3BFF8A]" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
      <span className="min-w-0"><span className="block font-semibold">{label}</span>{hint && <span className="block break-words text-xs text-muted-foreground">{hint}</span>}</span>
    </div>
  );
}

/** Adminbereich: Push-Server prüfen und per Knopfdruck in Supabase eintragen (SQL 017). */
export function PushServerAdmin() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: KEY, queryFn: () => api<PushServerStatus>("/api/push/admin/status", {}, true) });
  const setup = useMutation({
    mutationFn: () => api<PushServerStatus>("/api/push/admin/setup", { method: "POST" }, true),
    onSuccess: (s) => { qc.setQueryData(KEY, s); toast.success("Push-Server eingerichtet"); },
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  const s = status.data;
  const linked = !!s && s.db_configured && s.db_url_matches && s.db_secret_matches;
  return (
    <section data-testid="admin-push-server" className="neon-card space-y-3 p-3">
      <p className="flex items-center gap-2 font-display"><BellRing className="h-4 w-4 text-neon" />Push-Server</p>
      {status.isLoading && <p className="text-xs text-muted-foreground">Wird geprüft …</p>}
      {status.isError && <p data-testid="admin-push-error" className="text-xs text-destructive">{(status.error as Error).message}</p>}
      {s && <>
        <div className="space-y-2">
          <Row testId="admin-push-row-db" ok={s.db_ready} label="Datenbank-Update (SQL 017)" hint={s.db_ready ? undefined : "Bitte docs/migrations/017_push_einrichtung_admin.sql in Lovable ausführen."} />
          <Row testId="admin-push-row-link" ok={linked} label="Datenbank mit diesem Server verbunden"
            hint={!s.db_configured ? "Noch nicht eingerichtet – deshalb „PUSH_NOT_CONFIGURED“." : !s.db_url_matches ? `Eingetragen ist ${s.db_url ?? "?"}` : !s.db_secret_matches ? "Geheimer Schlüssel passt nicht – neu einrichten." : s.db_url ?? undefined} />
          <Row testId="admin-push-row-web" ok={s.web_keys && s.secret_set} label="Web-Push-Schlüssel (Browser/Home-Bildschirm)" />
          <Row testId="admin-push-row-apple" ok={s.apple_keys} label="Apple-Push-Schlüssel (iPhone-App)" hint={s.apple_keys ? undefined : "APNS_TEAM_ID, APNS_KEY_ID und APNS_PRIVATE_KEY fehlen auf dem Server."} />
        </div>
        <p className="text-[11px] text-muted-foreground">Trägt ein: <span data-testid="admin-push-server-url" className="break-all">{s.server_url}</span>. Nur in der Live-App tippen – sonst landen Mitteilungen beim Vorschau-Server.</p>
        <Button data-testid="admin-push-setup-button" className="w-full" disabled={!s.db_ready || !s.secret_set || setup.isPending} onClick={() => setup.mutate()}>
          {setup.isPending ? "Wird eingerichtet …" : linked ? "Erneut einrichten" : "Push jetzt einrichten"}
        </Button>
      </>}
    </section>
  );
}
