import { Link } from "@tanstack/react-router";
import { Check, Crown, LockKeyhole, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FramedAvatar } from "@/components/FramedAvatar";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useCoinBalance } from "@/lib/arcade";
import { DEFAULT_AVATAR } from "@/lib/db";
import { locale, tr } from "@/lib/i18n";
import { frameError, useBuyFrame, useEquipFrame, useMyFrames, type FrameEntry } from "@/lib/profile-frames";
import { useStore } from "@/lib/store";

const fmt = (n: number) => n.toLocaleString(locale());

/** Neoshop-Bereich „Profilrahmen“ (Kauf serverseitig per buy_profile_frame, SQL 029). */
export function FrameShop() {
  const { user, profiles } = useStore();
  const avatar = profiles.find((p) => p.id === user?.id)?.avatar ?? DEFAULT_AVATAR;
  const frames = useMyFrames(user?.id);
  const balance = useCoinBalance(!!user);
  const buy = useBuyFrame(user?.id);
  const equip = useEquipFrame(user?.id);
  const [confirm, setConfirm] = useState<FrameEntry | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const coins = typeof balance.data === "number" ? balance.data : 0;
  const setupMissing = !!frames.data?.setupMissing;
  const entries = frames.data?.entries ?? [];
  const missing = confirm ? Math.max(0, confirm.price - coins) : 0;

  const ask = (f: FrameEntry) => {
    if (!user) { toast.error(tr("Bitte melde dich an, um Profilrahmen zu kaufen.")); return; }
    if (setupMissing) { toast.error(tr("Profilrahmen werden nach dem Datenbank-Update (SQL 029) aktiv.")); return; }
    setUnlocked(false); setConfirm(f);
  };
  const doBuy = () => {
    if (!confirm || buy.isPending) return;
    buy.mutate(confirm.id, {
      onSuccess: (r) => { toast.success(r.already_owned ? tr("Dieser Profilrahmen gehört dir bereits – es wurden keine Coins abgezogen.") : tr("Profilrahmen freigeschaltet!")); setUnlocked(true); },
      onError: (e) => { toast.error(frameError(e as { code?: string; message?: string })); setConfirm(null); },
    });
  };
  const doEquip = (f: FrameEntry, close = false) => equip.mutate(f.id, {
    onSuccess: () => { toast.success(tr("{0} ist jetzt ausgerüstet.", f.name)); if (close) setConfirm(null); },
    onError: (e) => toast.error(frameError(e as { code?: string; message?: string })),
  });

  return <section data-testid="neoshop-frames" className="space-y-3">
    {setupMissing && <p data-testid="neoshop-frames-setup-hint" className="rounded-2xl border border-[#FFD12A]/40 bg-[#FFD12A]/10 p-3 text-xs text-[#FFE38A]">{tr("Profilrahmen werden nach dem Datenbank-Update (SQL 029) aktiv.")}</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {entries.map((f) => <article key={f.id} data-testid={`neoshop-frame-card-${f.id}`} className={`relative flex flex-col items-center rounded-3xl border-2 bg-[#160A2C]/95 p-3 text-center ${f.premium ? "border-[#FFC83D] shadow-[0_0_20px_rgba(255,200,61,0.45)]" : "border-[#FF2E97]/55 shadow-[0_0_16px_rgba(255,46,151,0.2)]"}`}>
        <div className="flex min-h-5 w-full flex-wrap justify-between gap-1">{f.premium ? <span className="inline-flex items-center gap-1 rounded-full bg-[#FFC83D] px-2 py-0.5 text-[10px] font-black uppercase text-[#2B0B47]"><Crown className="h-3 w-3" />{tr("Exklusiv")}</span> : <span />}
        {f.equipped && <span data-testid={`neoshop-frame-${f.id}-equipped`} className="inline-flex items-center gap-1 rounded-full bg-[#22E4F2] px-2 py-0.5 text-[10px] font-black uppercase text-[#0B0418]"><Check className="h-3 w-3" />{tr("Ausgerüstet")}</span>}</div>
        <FramedAvatar src={avatar} size={76} frameId={f.id} frameTestId={`neoshop-frame-${f.id}-preview`} />
        <h3 className="mt-1 font-display text-sm italic">{f.name}</h3>
        <span data-testid={`neoshop-frame-${f.id}-price`} className="mt-1 inline-flex items-center gap-1 font-bold text-[#FFD12A]"><span aria-hidden>🪙</span>{fmt(f.price)}</span>
        <div className="mt-2 w-full">
          {!f.owned
            ? <button type="button" data-testid={`neoshop-frame-${f.id}-buy-button`} onClick={() => ask(f)} className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF2E97] to-[#B026FF] text-sm font-bold shadow-[0_0_14px_rgba(255,46,151,0.4)] transition-transform duration-150 active:scale-95"><ShoppingCart className="h-4 w-4" />{tr("Kaufen")}</button>
            : f.equipped ? <span className="flex min-h-10 items-center justify-center rounded-xl border border-[#22E4F2]/40 text-xs font-bold text-[#22E4F2]">{tr("Freigeschaltet")}</span>
              : <button type="button" data-testid={`neoshop-frame-${f.id}-equip-button`} disabled={equip.isPending} onClick={() => doEquip(f)} className="min-h-10 w-full rounded-xl border border-[#22E4F2]/70 text-sm font-bold text-[#22E4F2] transition-transform duration-150 active:scale-95 disabled:opacity-50">{tr("Ausrüsten")}</button>}
        </div>
      </article>)}
    </div>
    <p className="rounded-2xl border border-border bg-card/55 p-4 text-center text-xs text-muted-foreground">{tr("Gekaufte Rahmen bleiben dauerhaft freigeschaltet. Ausrüsten kannst du sie hier oder in den Einstellungen unter „Profilrahmen“.")}</p>

    <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o && !buy.isPending) setConfirm(null); }}>
      <AlertDialogContent data-testid="neoshop-frame-dialog" className="border-[#FF2E97]/60 bg-[#1E0C38] text-white shadow-[0_0_30px_rgba(255,46,151,0.3)]">
        {confirm && (unlocked ? <>
          <AlertDialogHeader><AlertDialogTitle data-testid="neoshop-frame-unlocked-title" className="font-display text-2xl text-neon-gradient">{tr("Profilrahmen freigeschaltet!")}</AlertDialogTitle><AlertDialogDescription className="text-[#BFAAD9]">{tr("{0} gehört jetzt dauerhaft dir.", confirm.name)}</AlertDialogDescription></AlertDialogHeader>
          <div className="grid place-items-center"><FramedAvatar src={avatar} size={110} frameId={confirm.id} /></div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel data-testid="neoshop-frame-close-button" className="border-white/20 bg-transparent text-white">{tr("Schließen")}</AlertDialogCancel>
            <button type="button" data-testid="neoshop-frame-equip-now-button" disabled={equip.isPending} onClick={() => doEquip(confirm, true)} className="inline-flex min-h-10 items-center justify-center rounded-md bg-gradient-to-r from-[#FF2E97] to-[#B026FF] px-4 text-sm font-bold disabled:opacity-60">{tr("Jetzt ausrüsten")}</button>
          </AlertDialogFooter>
        </> : <>
          <AlertDialogHeader><AlertDialogTitle data-testid="neoshop-frame-dialog-title" className="font-display text-xl">{tr("{0} kaufen?", confirm.name)}</AlertDialogTitle><AlertDialogDescription className="text-[#BFAAD9]">{tr("Einmal kaufen, dauerhaft freigeschaltet. Es werden genau {0} Coins abgezogen.", fmt(confirm.price))}</AlertDialogDescription></AlertDialogHeader>
          <div className="grid place-items-center"><FramedAvatar src={avatar} size={96} frameId={confirm.id} /></div>
          <div className="space-y-1 rounded-2xl border border-white/10 bg-[#120624] p-3 text-sm">
            <p className="flex justify-between"><span className="text-[#BFAAD9]">{tr("Preis")}</span><span data-testid="neoshop-frame-dialog-price" className="font-bold text-[#FFD12A]">{tr("{0} Coins", fmt(confirm.price))}</span></p>
            <p className="flex justify-between"><span className="text-[#BFAAD9]">{tr("Dein Guthaben")}</span><span className="font-bold">{tr("{0} Coins", fmt(coins))}</span></p>
          </div>
          {missing > 0 && <p data-testid="neoshop-frame-insufficient" role="alert" className="rounded-2xl border border-[#FF2E97]/50 bg-[#FF2E97]/10 p-3 text-sm text-[#FFB3D9]">{tr("Dir fehlen noch {0} Coins. Sammle Coins in Neon Highway, Leonida Fishing oder durch Levelaufstiege.", fmt(missing))}</p>}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel data-testid="neoshop-frame-cancel-button" disabled={buy.isPending} className="border-white/20 bg-transparent text-white">{tr("Abbrechen")}</AlertDialogCancel>
            {missing > 0
              ? <AlertDialogAction asChild><Link to="/arcade" data-testid="neoshop-frame-earn-button" className="bg-[#22E4F2] text-[#0B0418]">{tr("Coins sammeln")}</Link></AlertDialogAction>
              : <button type="button" data-testid="neoshop-frame-confirm-button" disabled={buy.isPending} onClick={doBuy} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-[#FF2E97] to-[#B026FF] px-4 text-sm font-bold disabled:opacity-60"><ShoppingCart className="h-4 w-4" />{buy.isPending ? tr("Kauf läuft …") : tr("Für {0} Coins kaufen", fmt(confirm.price))}</button>}
          </AlertDialogFooter>
        </>)}
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}

/** Einstellungen → Profilrahmen: gekaufte Rahmen ausrüsten, „Kein Rahmen“, gesperrte mit Schloss + Preis. */
export function FramePicker({ userId, avatar }: { userId: string; avatar: string }) {
  const frames = useMyFrames(userId);
  const equip = useEquipFrame(userId);
  const equipped = frames.data?.equipped ?? null;
  const set = (id: FrameEntry["id"] | null, name: string) => equip.mutate(id, {
    onSuccess: () => toast.success(id ? tr("{0} ist jetzt ausgerüstet.", name) : tr("Profilrahmen entfernt.")),
    onError: (e) => toast.error(frameError(e as { code?: string; message?: string })),
  });
  return <div data-testid="settings-frame-picker" className="space-y-2">
    {frames.data?.setupMissing && <p data-testid="settings-frames-setup-hint" className="rounded-xl border border-[#FFD12A]/40 bg-[#FFD12A]/10 p-2 text-xs text-[#FFE38A]">{tr("Profilrahmen werden nach dem Datenbank-Update (SQL 029) aktiv.")}</p>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <FrameOption testId="settings-frame-none" name={tr("Kein Rahmen")} preview={<FramedAvatar src={avatar} size={58} frameId={null} className="my-[9px]" />} equipped={!equipped}
        action={!equipped ? null : <button type="button" data-testid="settings-frame-none-equip-button" disabled={equip.isPending || !!frames.data?.setupMissing} onClick={() => set(null, "")} className={ACTION}>{tr("Ausrüsten")}</button>} />
      {(frames.data?.entries ?? []).map((f) => <FrameOption key={f.id} testId={`settings-frame-${f.id}`} name={f.name} equipped={f.equipped}
        preview={<span className={f.owned ? "" : "opacity-55 grayscale-[35%]"}><FramedAvatar src={avatar} size={58} frameId={f.id} /></span>}
        locked={!f.owned ? fmt(f.price) : undefined}
        action={f.equipped ? null : f.owned
          ? <button type="button" data-testid={`settings-frame-${f.id}-equip-button`} disabled={equip.isPending} onClick={() => set(f.id, f.name)} className={ACTION}>{tr("Ausrüsten")}</button>
          : <Link to="/neoshop" search={{ tab: "frames" }} data-testid={`settings-frame-${f.id}-shop-link`} className={`${ACTION} inline-flex items-center justify-center gap-1 border-[#FF2E97]/70 text-[#FFB3D9]`}><ShoppingCart className="h-3.5 w-3.5" />{tr("Neoshop")}</Link>} />)}
    </div>
  </div>;
}

const ACTION = "min-h-10 w-full rounded-xl border border-[#22E4F2]/70 text-xs font-bold text-[#22E4F2] transition-transform duration-150 active:scale-95 disabled:opacity-50";

function FrameOption({ testId, name, preview, equipped, locked, action }: { testId: string; name: string; preview: React.ReactNode; equipped: boolean; locked?: string | undefined; action: React.ReactNode }) {
  return <div data-testid={testId} className={`flex flex-col items-center rounded-2xl border bg-[#160A2C]/80 p-2 text-center transition-[border-color,box-shadow] duration-150 ${equipped ? "border-[#22E4F2] shadow-[0_0_14px_rgba(34,228,242,0.35)]" : "border-white/10"}`}>
    {preview}
    <p className="mt-1 w-full truncate text-xs font-bold">{name}</p>
    {locked && <p data-testid={`${testId}-locked`} className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#FFD12A]"><LockKeyhole className="h-3 w-3" />{tr("{0} Coins", locked)}</p>}
    <div className="mt-1.5 w-full">{equipped ? <span data-testid={`${testId}-equipped`} className="flex min-h-10 items-center justify-center gap-1 rounded-xl bg-[#22E4F2] text-xs font-black text-[#0B0418]"><Check className="h-3.5 w-3.5" />{tr("Ausgerüstet")}</span> : action}</div>
  </div>;
}
