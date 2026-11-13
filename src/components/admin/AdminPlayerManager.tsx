import { useMemo, useState, type ReactNode } from "react";
import { Coins, Fish, History, Search, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LevelBadge } from "@/components/LevelBadge";
import { DEFAULT_AVATAR } from "@/lib/db";
import { levelFromXp } from "@/lib/levels";
import { newNonce } from "@/lib/fishing";
import { useStore } from "@/lib/store";
import {
  ADMIN_SETUP_HINT, CAST_QUICK, COIN_QUICK, REASON_PRESETS, adminGrantError, useAdminGrantHistory, useAdminPlayerDetail, useAdminPlayers, useGrant,
  type AdminGrant, type GrantKind,
} from "@/lib/admin-players";

const GOLD = "#FFD12A"; const CYAN = "#22E4F2"; const PINK = "#FF2E97";
const fmt = (n: number) => n.toLocaleString("de-DE");
const dt = (iso: string) => new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(new Date(iso));
const unit = (kind: GrantKind, n: number) => (kind === "coins" ? "Coins" : n === 1 ? "Angelversuch" : "Angelversuche");

/** Admin-Spielerverwaltung: Spieler suchen, Detailansicht, Coins + Bonus-Angelversuche vergeben, Admin-Gutschriften (SQL 035). */
export function AdminPlayerManager() {
  const { profiles } = useStore();
  const [q, setQ] = useState(""); const [openId, setOpenId] = useState<string | null>(null);
  const players = useAdminPlayers(q.trim());
  const avatarOf = useMemo(() => { const m = new Map(profiles.map((p) => [p.id, p.avatar])); return (id: string) => m.get(id) ?? DEFAULT_AVATAR; }, [profiles]);

  if (players.data === null) return <section data-testid="admin-player-manager" className="neon-card p-3"><p className="font-display">Spielerverwaltung</p><p data-testid="admin-player-setup-hint" className="text-xs text-muted-foreground">{ADMIN_SETUP_HINT}</p></section>;
  return <div className="space-y-3">
    <section data-testid="admin-player-manager" className="space-y-3 rounded-2xl border border-[#FF2E97]/60 bg-[#120A24]/90 p-3 shadow-[0_0_18px_rgba(255,46,151,0.22)] backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-lg"><UserCog className="h-5 w-5" style={{ color: PINK }} />Spielerverwaltung</p>
        <span data-testid="admin-player-count" className="text-xs text-muted-foreground">{players.data ? `${players.data.length} Spieler` : "…"}</span>
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-[#FF2E97]/40 bg-[#0B0418]/70 px-3 transition-[border-color] duration-150 focus-within:border-[#FF2E97]">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input data-testid="admin-player-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name oder E-Mail suchen …" autoComplete="off" className="min-h-12 w-full bg-transparent text-base outline-none" />
      </label>
      <ul data-testid="admin-player-list" className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-0.5">
        {(players.data ?? []).map((p) => <li key={p.id}>
          <button type="button" data-testid={`admin-player-row-${p.id}`} onClick={() => setOpenId(p.id)}
            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#FF2E97]/25 bg-[#0B0418]/60 px-3 py-2 text-left transition-[transform,border-color] duration-150 hover:border-[#FF2E97]/70 active:scale-[0.98]">
            <img src={avatarOf(p.id)} alt="" className="h-10 w-10 shrink-0 rounded-full border border-[#FF2E97]/50 object-cover" />
            <span className="min-w-0 flex-1">
              <span data-testid="admin-player-row-name" className="block truncate font-semibold">{p.username ?? "(ohne Namen)"}{p.is_admin && <span className="ml-1.5 rounded-full bg-accent/20 px-1.5 text-[10px] font-bold text-accent">ADMIN</span>}</span>
              <span className="block truncate text-xs text-muted-foreground">{p.email ?? ""}</span>
            </span>
            <LevelBadge xp={p.xp} />
            <span data-testid="admin-player-row-coins" className="flex shrink-0 items-center gap-1 text-sm font-bold" style={{ color: GOLD }}><Coins className="h-4 w-4" />{fmt(p.coins)}</span>
          </button>
        </li>)}
        {players.isLoading && <li className="text-xs text-muted-foreground">Lade Spieler …</li>}
        {players.data?.length === 0 && <li data-testid="admin-player-empty" className="text-xs text-muted-foreground">Kein Spieler gefunden.</li>}
      </ul>
    </section>
    <AdminGrantLog />
    <Sheet open={!!openId} onOpenChange={(o) => { if (!o) setOpenId(null); }}>
      <SheetContent side="bottom" data-testid="admin-player-detail" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl border-t-2 border-[#FF2E97]/70 bg-[#120A24] px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {openId && <PlayerDetail key={openId} id={openId} avatar={avatarOf(openId)} />}
      </SheetContent>
    </Sheet>
  </div>;
}

function PlayerDetail({ id, avatar }: { id: string; avatar: string }) {
  const detail = useAdminPlayerDetail(id);
  const history = useAdminGrantHistory(id);
  const d = detail.data;
  return <div className="space-y-4">
    <SheetHeader className="text-left">
      <div className="flex items-center gap-3">
        <img src={avatar} alt="" className="h-16 w-16 rounded-full border-2 border-[#FF2E97] object-cover shadow-[0_0_16px_rgba(255,46,151,0.45)]" />
        <div className="min-w-0">
          <SheetTitle data-testid="admin-detail-name" className="truncate font-display text-xl">{d?.username ?? (detail.isLoading ? "…" : "(ohne Namen)")}</SheetTitle>
          <SheetDescription className="truncate text-xs">{d?.email ?? ""}{d?.is_admin ? " · Admin" : ""}</SheetDescription>
        </div>
      </div>
    </SheetHeader>
    {detail.data === null && <p className="text-xs text-muted-foreground">{ADMIN_SETUP_HINT}</p>}
    {detail.isError && <p className="text-xs text-destructive">{adminGrantError(detail.error as { message?: string })}</p>}
    {d && <>
      <div className="grid grid-cols-2 gap-2">
        <Stat testId="admin-detail-level" label="Level" value={<span className="flex items-center gap-2"><LevelBadge xp={d.xp} />{levelFromXp(d.xp)}</span>} sub={`${fmt(d.xp)} XP`} />
        <Stat testId="admin-detail-coins" label="Leonida Coins" color={GOLD} icon={<Coins className="h-4 w-4" />} value={fmt(d.coins)} />
        <Stat testId="admin-detail-casts-used" label="Angelversuche heute verwendet" color={CYAN} icon={<Fish className="h-4 w-4" />} value={fmt(d.casts_used_today)} sub={d.bonus_used_today ? `davon ${fmt(d.bonus_used_today)} Bonus` : undefined} />
        <Stat testId="admin-detail-casts-left" label="Verbleibend heute" color={CYAN} icon={<Fish className="h-4 w-4" />} value={`${d.daily_left}/${d.daily_limit}`} sub={`+ ${fmt(d.bonus_casts)} Bonus`} />
        <Stat testId="admin-detail-bonus" label="Bonus-Angelversuche verfügbar" color={CYAN} value={fmt(d.bonus_casts)} />
        <Stat testId="admin-detail-bonus-total" label="Bisher erhaltene Bonusversuche" color={CYAN} value={fmt(d.bonus_granted_total)} />
      </div>
      <GrantPanel kind="coins" userId={d.id} name={d.username ?? "Spieler"} />
      <GrantPanel kind="fishing_casts" userId={d.id} name={d.username ?? "Spieler"} />
      <div data-testid="admin-detail-history" className="space-y-1.5">
        <p className="flex items-center gap-2 font-display text-sm"><History className="h-4 w-4" style={{ color: PINK }} />Gutschriften an {d.username ?? "Spieler"}</p>
        <GrantList rows={history.data ?? []} compact />
        {history.data?.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Gutschriften.</p>}
      </div>
    </>}
  </div>;
}

function Stat({ label, value, sub, color, icon, testId }: { label: string; value: ReactNode; sub?: string | undefined; color?: string; icon?: ReactNode; testId: string }) {
  return <div data-testid={testId} className="rounded-2xl border border-[#FF2E97]/35 bg-[#0B0418]/70 p-3">
    <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    <p className="mt-1 flex items-center gap-1.5 font-display text-xl" style={color ? { color } : undefined}>{icon}{value}</p>
    {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
  </div>;
}

function GrantPanel({ kind, userId, name }: { kind: GrantKind; userId: string; name: string }) {
  const coins = kind === "coins"; const color = coins ? GOLD : CYAN;
  const grant = useGrant();
  const [amountText, setAmountText] = useState(""); const [preset, setPreset] = useState<string | null>(null); const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  // Schlüssel bleibt für dieselbe Gutschrift erhalten (auch nach Netzwerkfehler) → nie doppelt
  const [pending, setPending] = useState<{ sig: string; key: string } | null>(null);
  const amount = /^\d{1,15}$/.test(amountText) ? Number(amountText) : 0;
  const reason = [preset, note.trim()].filter(Boolean).join(" – ");
  const sig = `${userId}:${kind}:${amount}`;
  const T = coins
    ? { title: "Coins vergeben", button: "Coins gutschreiben", quick: COIN_QUICK, prefix: "coins" }
    : { title: "Angelversuche vergeben", button: "Angelversuche gutschreiben", quick: CAST_QUICK, prefix: "casts" };

  const open = () => { if (pending?.sig !== sig) setPending({ sig, key: newNonce() }); setConfirm(true); };
  const submit = () => {
    const key = pending?.sig === sig ? pending.key : newNonce();
    setPending({ sig, key });
    grant.mutate({ kind, userId, amount, reason, key }, {
      onSuccess: (r) => {
        toast.success(r.already_processed ? "Bereits gutgeschrieben – nichts doppelt gebucht." : `${fmt(amount)} ${unit(kind, amount)} an ${name} gutgeschrieben`);
        setPending(null); setAmountText(""); setPreset(null); setNote(""); setConfirm(false);
      },
      onError: (e) => { toast.error(adminGrantError(e as { message?: string })); setConfirm(false); },
    });
  };

  return <section data-testid={`admin-grant-${T.prefix}`} className="space-y-3 rounded-2xl border p-3" style={{ borderColor: `${color}80`, background: "rgba(11,4,24,0.75)", boxShadow: `0 0 14px ${color}22` }}>
    <p className="flex items-center gap-2 font-display" style={{ color }}>{coins ? <Coins className="h-5 w-5" /> : <Fish className="h-5 w-5" />}{T.title}</p>
    <div className="grid grid-cols-4 gap-2">
      {T.quick.map((n) => <button key={n} type="button" data-testid={`admin-grant-${T.prefix}-quick-${n}`} onClick={() => setAmountText(String(n))}
        className="min-h-12 rounded-xl border text-sm font-bold transition-[transform,background-color] duration-150 active:scale-95"
        style={amount === n ? { background: color, color: "#120A24", borderColor: color } : { borderColor: `${color}70`, color }}>+{fmt(n)}</button>)}
    </div>
    <input data-testid={`admin-grant-${T.prefix}-amount`} inputMode="numeric" pattern="[0-9]*" placeholder={coins ? "Eigene Anzahl Coins" : "Eigene Anzahl Angelversuche"} value={amountText}
      onChange={(e) => setAmountText(e.target.value.replace(/\D/g, "").slice(0, 15))}
      className="min-h-12 w-full rounded-xl border border-[#FF2E97]/40 bg-[#120A24] px-3 text-base outline-none transition-[border-color] duration-150 focus:border-[#FF2E97]" />
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Grund (optional)</p>
      <div className="flex flex-wrap gap-1.5">{REASON_PRESETS.map((r) => <button key={r} type="button" data-testid={`admin-grant-${T.prefix}-reason-${r}`} onClick={() => setPreset(preset === r ? null : r)}
        className={`min-h-10 rounded-full border px-3 text-xs font-semibold transition-[transform,background-color] duration-150 active:scale-95 ${preset === r ? "border-[#FF2E97] bg-[#FF2E97] text-white" : "border-[#FF2E97]/40 text-[#FFB3D9]"}`}>{r}</button>)}</div>
      <input data-testid={`admin-grant-${T.prefix}-note`} placeholder="Eigener Grund …" maxLength={150} value={note} onChange={(e) => setNote(e.target.value)}
        className="min-h-11 w-full rounded-xl border border-[#FF2E97]/30 bg-[#120A24] px-3 text-base outline-none transition-[border-color] duration-150 focus:border-[#FF2E97]" />
    </div>
    <button type="button" data-testid={`admin-grant-${T.prefix}-submit`} disabled={amount <= 0 || grant.isPending} onClick={open}
      className="min-h-14 w-full rounded-2xl text-base font-bold transition-[transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-40"
      style={{ background: color, color: "#120A24", boxShadow: `0 0 18px ${color}55` }}>{grant.isPending ? "Wird gutgeschrieben …" : amount > 0 ? `${T.button} (+${fmt(amount)})` : T.button}</button>

    <AlertDialog open={confirm} onOpenChange={(o) => { if (!grant.isPending) setConfirm(o); }}>
      <AlertDialogContent data-testid={`admin-grant-${T.prefix}-confirm-dialog`} className="rounded-3xl border-2 border-[#FF2E97]/70 bg-[#120A24]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{T.button}?</AlertDialogTitle>
          <AlertDialogDescription data-testid={`admin-grant-${T.prefix}-confirm-text`} className="text-base">
            <b style={{ color }}>{fmt(amount)} {unit(kind, amount)}</b> an <b className="text-white">{name}</b> gutschreiben?{reason && <span className="mt-1 block text-sm">Grund: {reason}</span>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel data-testid={`admin-grant-${T.prefix}-cancel`} disabled={grant.isPending} className="min-h-12">Abbrechen</AlertDialogCancel>
          <AlertDialogAction data-testid={`admin-grant-${T.prefix}-confirm`} disabled={grant.isPending} onClick={(e) => { e.preventDefault(); submit(); }}
            className="min-h-12 font-bold" style={{ background: color, color: "#120A24" }}>{grant.isPending ? "Wird gutgeschrieben …" : "Bestätigen"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}

function GrantList({ rows, compact = false }: { rows: AdminGrant[]; compact?: boolean }) {
  return <ul className="space-y-1.5">{rows.map((g) => {
    const coins = g.kind === "coins";
    return <li key={g.id} data-testid={`admin-grant-entry-${g.id}`} className="rounded-xl border border-[#FF2E97]/25 bg-[#0B0418]/60 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        {!compact && <span data-testid="admin-grant-entry-player" className="truncate font-semibold text-white">{g.target_name ?? "Gelöschter Spieler"}</span>}
        <span data-testid="admin-grant-entry-amount" className="flex shrink-0 items-center gap-1 font-bold" style={{ color: coins ? GOLD : CYAN }}>
          {coins ? <Coins className="h-3.5 w-3.5" /> : <Fish className="h-3.5 w-3.5" />}+{fmt(g.amount)} {unit(g.kind, g.amount)}</span>
        {compact && <span className="text-muted-foreground">{dt(g.created_at)}</span>}
      </div>
      <p className="mt-0.5 text-muted-foreground">{!compact && <>{dt(g.created_at)} · </>}von <span data-testid="admin-grant-entry-admin" className="text-[#FFB3D9]">{g.admin_name ?? "Admin"}</span>{g.reason && <> · {g.reason}</>}</p>
    </li>;
  })}</ul>;
}

function AdminGrantLog() {
  const log = useAdminGrantHistory(null);
  return <details data-testid="admin-grant-log" className="rounded-2xl border border-[#FF2E97]/60 bg-[#120A24]/90 p-3 shadow-[0_0_18px_rgba(255,46,151,0.18)]">
    <summary className="flex min-h-10 cursor-pointer items-center gap-2 font-display"><ShieldCheck className="h-5 w-5" style={{ color: PINK }} />Admin-Gutschriften ({log.data?.length ?? 0})</summary>
    <div className="mt-2 max-h-96 overflow-y-auto"><GrantList rows={log.data ?? []} /></div>
    {log.data?.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Noch keine Gutschriften.</p>}
  </details>;
}

