import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clapperboard } from "lucide-react";
import { toast } from "sonner";
import { ADS_ENABLED } from "@/lib/ads";
import { isMissing, sb } from "@/lib/db";

type Mode = "off" | "test" | "live";
interface AdConfig { mode: Mode; ios_bonus_unit_id: string | null; ios_bait_unit_id: string | null; ssv_secret_ready: boolean; granted_today: number; granted_ssv_total: number }
const KEY = ["admin-ad-config"];
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "off", label: "Aus", hint: "Keine Werbe-Angebote in der App" },
  { id: "test", label: "Test", hint: "Nur Google-Testanzeigen, Testablauf ohne SSV" },
  { id: "live", label: "Live", hint: "Echte Anzeigen, Belohnung nur nach Google-SSV" },
];

/** Admin: AdMob-Modus und produktive Rewarded-Anzeigenblöcke (SQL 037). Live erst nach AdMob-Freigabe! */
export function AdConfigAdmin() {
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: KEY, queryFn: async () => {
    const { data, error } = await sb.rpc("admin_ad_reward_config");
    if (error) { if (isMissing(error)) return null; throw error; }
    return data as AdConfig;
  } });
  const [mode, setMode] = useState<Mode>("test"); const [bonus, setBonus] = useState(""); const [bait, setBait] = useState("");
  useEffect(() => { if (cfg.data) { setMode(cfg.data.mode); setBonus(cfg.data.ios_bonus_unit_id ?? ""); setBait(cfg.data.ios_bait_unit_id ?? ""); } }, [cfg.data]);
  const save = useMutation({
    mutationFn: async () => { const { data, error } = await sb.rpc("admin_set_ad_reward_config", { _mode: mode, _bonus_unit: bonus, _bait_unit: bait }); if (error) throw error; return data as AdConfig; },
    onSuccess: () => { toast.success("AdMob-Einstellungen gespeichert"); void qc.invalidateQueries({ queryKey: KEY }); },
    onError: (e: { message?: string }) => toast.error(/AD_UNITS_REQUIRED|live_units/.test(e.message ?? "") ? "Für Live beide Anzeigenblock-IDs eintragen." : /AD_UNITS_ARE_TEST_IDS/.test(e.message ?? "") ? "Für Live keine Google-Test-IDs verwenden." : /check constraint|ios_/.test(e.message ?? "") ? "Ungültige Anzeigenblock-ID (Format ca-app-pub-…/…)." : "Speichern fehlgeschlagen."),
  });
  const d = cfg.data;
  return <details data-testid="admin-ad-config" className="neon-card p-3">
    <summary className="flex min-h-10 cursor-pointer items-center gap-2 font-display"><Clapperboard className="h-5 w-5 text-[#22E4F2]" />Werbung (AdMob){d ? ` · ${MODES.find((m) => m.id === d.mode)?.label}` : ""}</summary>
    {!ADS_ENABLED && <p data-testid="admin-ad-globally-disabled" className="mt-2 rounded-xl border border-[#FFD12A]/50 bg-[#FFD12A]/10 p-2 text-xs text-[#FFE58A]">Werbung ist in der App vorübergehend komplett deaktiviert (zentraler Schalter <code>ADS_ENABLED = false</code> in <code>src/lib/ads.ts</code>). Es erscheinen keine Werbebuttons, keine Anzeigen und es werden keine Werbebelohnungen vergeben – unabhängig vom Modus unten. Empfehlung: Modus zusätzlich auf „Aus“ stellen.</p>}
    {d === null && <p className="mt-2 text-xs text-muted-foreground">Wird nach dem Datenbank-Update (SQL 037) aktiv.</p>}
    {d && <div className="mt-3 space-y-3">
      <div className="grid grid-cols-3 gap-2">{MODES.map((m) => <button key={m.id} type="button" data-testid={`admin-ad-mode-${m.id}`} onClick={() => setMode(m.id)}
        className={`min-h-11 rounded-xl border text-sm font-bold transition-[background-color,transform] duration-150 active:scale-95 ${mode === m.id ? "border-[#FF2E97] bg-[#FF2E97] text-white" : "border-[#FF2E97]/40 text-[#FFB3D9]"}`}>{m.label}</button>)}</div>
      <p className="text-xs text-muted-foreground">{MODES.find((m) => m.id === mode)?.hint}</p>
      <label className="block text-xs">Anzeigenblock „fishing_bonus_casts“ (iOS)
        <input data-testid="admin-ad-bonus-unit" value={bonus} onChange={(e) => setBonus(e.target.value.trim())} placeholder="ca-app-pub-…/…" className="mt-1 min-h-11 w-full rounded-xl border border-[#FF2E97]/40 bg-[#120A24] px-3 text-sm outline-none focus:border-[#FF2E97]" /></label>
      <label className="block text-xs">Anzeigenblock „fishing_special_bait“ (iOS)
        <input data-testid="admin-ad-bait-unit" value={bait} onChange={(e) => setBait(e.target.value.trim())} placeholder="ca-app-pub-…/…" className="mt-1 min-h-11 w-full rounded-xl border border-[#FF2E97]/40 bg-[#120A24] px-3 text-sm outline-none focus:border-[#FF2E97]" /></label>
      <p data-testid="admin-ad-status" className="text-xs text-muted-foreground">SSV-Schlüssel: {d.ssv_secret_ready ? "bereit" : "fehlt (Push-Server einrichten)"} · Belohnungen heute: {d.granted_today} · per SSV bestätigt: {d.granted_ssv_total}</p>
      <button type="button" data-testid="admin-ad-save" disabled={save.isPending} onClick={() => save.mutate()} className="min-h-12 w-full rounded-xl bg-[#22E4F2] font-bold text-[#120A24] transition-[transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-50">Speichern</button>
    </div>}
  </details>;
}
