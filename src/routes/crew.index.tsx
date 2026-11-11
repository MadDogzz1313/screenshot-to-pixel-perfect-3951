import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ChevronRight, Flame, Hourglass, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { NotificationBell } from "@/components/social/NotificationBell";
import {
  CrewHero,
  CrewMeta,
  Disclaimer,
  NeonUnderline,
  PlayerCount,
  SlotGrid,
  SlotsPill,
  StartLine,
  ghostButton,
  glassBtn,
  neonPanel,
  pinkButton,
} from "@/components/crew/CrewUi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import heroImg from "@/assets/crew/hero.webp";
import { useStore } from "@/lib/store";
import {
  CREW_SETUP_HINT,
  LANGUAGES,
  PLATFORMS,
  crewError,
  isFull,
  useCrewActions,
  useCrewActivities,
  useCrewBrowse,
  useMyCrews,
  type Crew,
  type CrewFilters,
  type Language,
  type Platform,
} from "@/lib/crew";

import { tr } from "@/lib/i18n";
export const Route = createFileRoute("/crew/")({
  head: () => ({
    meta: [
      { title: tr("Crew Finder · Leonida Explorer") },
      {
        name: "description",
        content: tr("Finde Mitspieler für gemeinsame Missionen, Rennen und Erkundungstouren."),
      },
    ],
  }),
  component: CrewFinder,
});

const chip = (on: boolean) =>
  `min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-[background-color,border-color,box-shadow] duration-150 active:scale-95 ${on ? "border-[#FF7BE5] bg-[#FF2E97]/25 text-white shadow-[0_0_14px_rgba(255,79,216,0.45)]" : "border-[#B98BFF]/35 bg-[#1A0B2E]/70 text-white/75"}`;
const ALL = "all";

function CrewFinder() {
  const { user, authReady } = useStore();
  const [f, setF] = useState<CrewFilters>({
    platform: null,
    activity: null,
    language: null,
    minFree: 0,
  });
  const activities = useCrewActivities(false, !!user);
  const browse = useCrewBrowse(f, !!user);
  const mine = useMyCrews(!!user);
  const setup = browse.data === null || activities.data === null;
  const myActive = (mine.data ?? []).filter((c) => !c.expired);
  return (
    <AppShell>
      <div className="-mt-0 pb-4">
        <CrewHero
          image={heroImg}
          tall
          left={
            <Link
              to="/community"
              aria-label={tr("Zurück zur Community")}
              data-testid="crew-back-button"
              className={glassBtn}
            >
              <ArrowLeft className="h-6 w-6" />
            </Link>
          }
          right={user ? <NotificationBell /> : undefined}
        >
          <h1
            data-testid="crew-title"
            className="flex items-center justify-center gap-2.5 font-display text-[2.6rem] italic leading-none text-[#FFC4F3] drop-shadow-[0_0_16px_rgba(255,79,216,0.95)]"
          >
            <Users className="h-10 w-10 fill-[#FF7BE5] text-[#FF7BE5]" />
            Crew Finder
          </h1>
          <p data-testid="crew-subtitle" className="mt-2 text-center text-[15px] text-white/90">
            {tr("Finde Mitspieler für gemeinsame Missionen")}</p>
          <NeonUnderline />
        </CrewHero>

        <div className="space-y-4 px-3">
          {!authReady ? (
            <p className="text-center text-sm text-white/70">{tr("Wird geladen …")}</p>
          ) : !user ? (
            <div data-testid="crew-login-hint" className={`${neonPanel} p-5 text-center`}>
              <p className="font-semibold">
                {tr("Melde dich an, um Crews zu finden und selbst eine Crew-Suche zu starten.")}</p>
              <Link to="/" data-testid="crew-login-link" className={`${pinkButton} mt-4`}>
                {tr("Anmelden")}</Link>
            </div>
          ) : setup ? (
            <p data-testid="crew-setup-hint" className={`${neonPanel} p-4 text-sm text-white/80`}>
              {CREW_SETUP_HINT}
            </p>
          ) : (
            <>
              <Link
                to="/crew/neu"
                data-testid="crew-create-link"
                className="flex min-h-14 items-center justify-center gap-3 rounded-full border-2 border-[#FFB36B]/80 bg-gradient-to-r from-[#FF7A2F] via-[#FF2E97] to-[#D61CFF] text-lg font-bold text-white shadow-[0_0_26px_rgba(255,110,80,0.55)] transition-transform duration-150 active:scale-[0.98]"
              >
                <UserPlus className="h-6 w-6 text-[#FFE08A]" />
                {tr("Eigene Crew-Suche erstellen")}</Link>

              {myActive.length > 0 && (
                <section data-testid="crew-mine" className="space-y-2">
                  <h2 className="px-1 text-xs font-bold tracking-[0.2em] text-white/60">
                    {tr("MEINE CREWS")}</h2>
                  <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
                    {myActive.map((c) => (
                      <Link
                        key={c.id}
                        to="/crew/$id"
                        params={{ id: c.id }}
                        data-testid={`crew-mine-${c.id}`}
                        className="flex min-w-[200px] items-center gap-3 rounded-2xl border border-[#FF4FD8]/45 bg-[#1F0D36]/85 p-3 transition-transform duration-150 active:scale-[0.97]"
                      >
                        <span className="text-2xl">{c.activity_emoji}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{tr(c.activity_label)}</span>
                          <span className="block text-[11px] text-[#CDB4F5]">
                            {c.my_role === "leader" ? tr("Du bist Crew-Leader") : tr("Mitglied")} ·{" "}
                            {c.members.length + c.external_players}/{c.max_players}
                          </span>
                        </span>
                        <ChevronRight className="ml-auto h-5 w-5 text-white/50" />
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              <section data-testid="crew-filters" className={`${neonPanel} space-y-3 p-3`}>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
                  {[{ id: null, label: tr("Alle Plattformen") }, ...PLATFORMS].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      data-testid={`crew-filter-platform-${p.id ?? "all"}`}
                      onClick={() => setF((v) => ({ ...v, platform: p.id as Platform | null }))}
                      className={chip(f.platform === p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={f.activity ?? ALL}
                    onValueChange={(v) => setF((x) => ({ ...x, activity: v === ALL ? null : v }))}
                  >
                    <SelectTrigger
                      data-testid="crew-filter-activity"
                      className="min-h-11 rounded-2xl border-[#B98BFF]/40 bg-[#1A0B2E]/80 text-base"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{tr("Alle Aktivitäten")}</SelectItem>
                      {(activities.data ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.emoji} {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={f.language ?? ALL}
                    onValueChange={(v) =>
                      setF((x) => ({ ...x, language: v === ALL ? null : (v as Language) }))
                    }
                  >
                    <SelectTrigger
                      data-testid="crew-filter-language"
                      className="min-h-11 rounded-2xl border-[#B98BFF]/40 bg-[#1A0B2E]/80 text-base"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{tr("Alle Sprachen")}</SelectItem>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1">
                  <span className="shrink-0 text-xs font-semibold text-white/60">{tr("Freie Plätze")}</span>
                  {[0, 1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      data-testid={`crew-filter-free-${n}`}
                      onClick={() => setF((v) => ({ ...v, minFree: n }))}
                      className={chip(f.minFree === n)}
                    >
                      {n === 0 ? tr("Alle") : `${n}+`}
                    </button>
                  ))}
                </div>
              </section>

              {browse.isError && (
                <p data-testid="crew-error" className={`${neonPanel} p-4 text-sm`}>
                  {crewError(browse.error)}
                </p>
              )}
              {browse.isLoading && <div className={`${neonPanel} h-72 animate-pulse`} />}
              {browse.data && !browse.data.length && (
                <div data-testid="crew-empty" className={`${neonPanel} p-6 text-center`}>
                  <Hourglass className="mx-auto h-8 w-8 text-[#FF7BE5]" />
                  <p className="mt-2 font-semibold">{tr("Gerade keine passenden Crew-Suchen.")}</p>
                  <p className="mt-1 text-sm text-white/65">
                    {tr("Ändere die Filter oder starte selbst eine Crew-Suche.")}</p>
                </div>
              )}
              <div data-testid="crew-list" className="space-y-4">
                {browse.data?.map((c) => (
                  <CrewCard key={c.id} crew={c} />
                ))}
              </div>
              <Disclaimer />
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function CrewCard({ crew }: { crew: Crew }) {
  const actions = useCrewActions();
  const full = isFull(crew);
  const join = () =>
    actions.requestJoin.mutate(crew.id, {
      onSuccess: () => toast.success(tr("Anfrage gesendet – der Crew-Leader wird benachrichtigt.")),
      onError: (e) => toast.error(crewError(e)),
    });
  const cancel = () =>
    actions.cancelJoin.mutate(crew.id, {
      onSuccess: () => toast.success(tr("Anfrage zurückgezogen")),
      onError: (e) => toast.error(crewError(e)),
    });
  return (
    <article
      data-testid={`crew-card-${crew.id}`}
      className={`${neonPanel} overflow-hidden transition-transform duration-200 hover:-translate-y-0.5`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#FF4FD8]/20 px-4 py-3">
        <span className="flex items-center gap-2 font-display text-xl italic text-[#FF9BEA] drop-shadow-[0_0_8px_rgba(255,79,216,0.7)]">
          <Flame className="h-6 w-6 fill-[#FF8A3D] text-[#FFB36B]" />
          {tr("Crew gesucht")}</span>
        <SlotsPill crew={crew} />
      </div>
      <Link
        to="/crew/$id"
        params={{ id: crew.id }}
        data-testid={`crew-card-open-${crew.id}`}
        className="block space-y-3 px-4 pb-3 pt-3"
      >
        <h3
          data-testid="crew-card-title"
          className="flex items-center gap-2.5 text-[1.35rem] font-bold leading-tight text-white"
        >
          <span className="text-3xl">{crew.activity_emoji}</span>
          {tr(crew.activity_label)} {tr("– Crew aufbauen")}</h3>
        <CrewMeta crew={crew} />
        <SlotGrid crew={crew} />
        {crew.description && (
          <p
            data-testid="crew-card-description"
            className="line-clamp-3 text-sm leading-relaxed text-white/80"
          >
            {crew.description}
          </p>
        )}
        <StartLine crew={crew} />
      </Link>
      <div className="flex items-center justify-between gap-3 border-t border-[#FF4FD8]/20 px-4 py-3">
        <PlayerCount crew={crew} />
        {crew.my_role ? (
          <Link
            to="/crew/$id"
            params={{ id: crew.id }}
            data-testid={`crew-card-lobby-${crew.id}`}
            className={pinkButton}
          >
            {tr("Zur Lobby")}<ChevronRight className="h-5 w-5" />
          </Link>
        ) : crew.my_request === "pending" ? (
          <button
            type="button"
            data-testid={`crew-card-cancel-${crew.id}`}
            onClick={cancel}
            disabled={actions.cancelJoin.isPending}
            className={ghostButton}
          >
            {tr("Anfrage gesendet · zurückziehen")}</button>
        ) : full ? (
          <span data-testid={`crew-card-full-${crew.id}`} className={`${ghostButton} opacity-70`}>
            {tr("Crew vollständig")}</span>
        ) : (
          <button
            type="button"
            data-testid={`crew-card-join-${crew.id}`}
            onClick={join}
            disabled={actions.requestJoin.isPending}
            className={pinkButton}
          >
            {tr("Crew beitreten")}<ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </article>
  );
}
