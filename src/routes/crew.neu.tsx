import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Crosshair,
  Gamepad2,
  Globe,
  Headphones,
  Pencil,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CrewHero, glassBtn, neonPanel } from "@/components/crew/CrewUi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import heroImg from "@/assets/crew/hero.webp";
import { useStore } from "@/lib/store";
import {
  CREW_SETUP_HINT,
  LANGUAGES,
  PLATFORMS,
  crewError,
  useCrewActions,
  useCrewActivities,
  useCrewDetail,
  type CrewInput,
  type Language,
  type Platform,
  type StartMode,
} from "@/lib/crew";

export const Route = createFileRoute("/crew/neu")({
  validateSearch: (s: Record<string, unknown>): { edit?: string } =>
    typeof s["edit"] === "string" ? { edit: s["edit"] } : {},
  head: () => ({
    meta: [{ title: "Neue Crew-Suche · Leonida Explorer" }, { name: "robots", content: "noindex" }],
  }),
  component: NewCrew,
});

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const numBtn = (on: boolean) =>
  `grid h-12 min-w-[3.75rem] place-items-center rounded-full border-2 px-3 font-display text-xl transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-95 ${on ? "border-[#FF7BE5] bg-[#3A0F4F] text-white shadow-[0_0_16px_rgba(255,79,216,0.6)]" : "border-[#B98BFF]/30 bg-[#1A0B2E]/80 text-white/80"}`;
const selectCls =
  "min-h-12 rounded-2xl border-2 border-[#FF7BE5]/45 bg-[#140822]/90 px-4 text-base text-white";

function Section({
  icon,
  title,
  children,
  testId,
  right,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  testId: string;
  right?: ReactNode;
}) {
  return (
    <section
      data-testid={testId}
      className="space-y-3 rounded-3xl border border-[#B98BFF]/25 bg-[#1C0C30]/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
    >
      <div className="flex items-center gap-3">
        <span className="text-[#FF7BE5] drop-shadow-[0_0_8px_rgba(255,79,216,0.8)]">{icon}</span>
        <h2 className="flex-1 text-[17px] font-semibold text-white">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function NewCrew() {
  const { user, authReady } = useStore();
  const { edit } = Route.useSearch();
  const activities = useCrewActivities(false, !!user);
  const existing = useCrewDetail(edit ?? "", !!user && !!edit);
  if (!authReady)
    return (
      <AppShell>
        <p className="p-6 text-center text-sm">Wird geladen …</p>
      </AppShell>
    );
  if (!user)
    return (
      <AppShell>
        <div className={`${neonPanel} m-4 p-5 text-center`}>
          <p className="font-semibold">Bitte melde dich an, um eine Crew-Suche zu erstellen.</p>
          <Link to="/" className="mt-3 inline-block text-neon">
            Anmelden
          </Link>
        </div>
      </AppShell>
    );
  if (activities.data === null)
    return (
      <AppShell>
        <p data-testid="crew-setup-hint" className={`${neonPanel} m-4 p-4 text-sm`}>
          {CREW_SETUP_HINT}
        </p>
      </AppShell>
    );
  if (!activities.data || (edit && !existing.data && !existing.isError))
    return (
      <AppShell>
        <div className={`${neonPanel} m-4 h-96 animate-pulse`} />
      </AppShell>
    );
  if (edit && (existing.isError || existing.data?.my_role !== "leader"))
    return (
      <AppShell>
        <p className={`${neonPanel} m-4 p-4 text-sm`}>
          {existing.isError
            ? crewError(existing.error)
            : "Nur der Crew-Leader kann die Suche bearbeiten."}
        </p>
      </AppShell>
    );
  return (
    <AppShell>
      <CrewForm key={edit ?? "new"} editId={edit} />
    </AppShell>
  );
}

function CrewForm({ editId }: { editId?: string | undefined }) {
  const nav = useNavigate();
  const activities = useCrewActivities().data ?? [];
  const crew = useCrewDetail(editId ?? "", !!editId).data ?? null;
  const actions = useCrewActions();
  const inApp = crew ? crew.members.length : 1; // Spieler mit App-Konto (beim Erstellen: du)
  const [v, setV] = useState<CrewInput>(() =>
    crew
      ? {
          activity: crew.activity_id,
          platform: crew.platform,
          language: crew.language,
          headset: crew.headset_required,
          max: crew.max_players,
          external: crew.external_players,
          description: crew.description,
          startMode: crew.start_mode,
          startAt: crew.start_at,
        }
      : {
          activity: activities[0]?.id ?? "",
          platform: "playstation",
          language: "de",
          headset: false,
          max: activities[0]?.default_max ?? 4,
          external: 0,
          description: "",
          startMode: "now",
          startAt: null,
        },
  );
  const act =
    activities.find((a) => a.id === v.activity) ??
    (crew
      ? {
          id: crew.activity_id,
          label: crew.activity_label,
          emoji: crew.activity_emoji,
          max_limit: crew.max_players,
          default_max: crew.max_players,
          sort: 0,
          active: false,
        }
      : undefined);
  const maxOptions = useMemo(
    () => Array.from({ length: Math.max(0, (act?.max_limit ?? 4) - 1) }, (_, i) => i + 2),
    [act?.max_limit],
  );
  // "Bereits vorhandene Spieler" inkl. dir (bzw. aller App-Mitglieder); mindestens ein Platz bleibt frei
  const present = inApp + v.external;
  const presentOptions = Array.from(
    { length: Math.max(0, v.max - inApp) },
    (_, i) => i + inApp,
  ).filter((n) => (editId ? n <= v.max : n < v.max));
  useEffect(() => {
    const lim = editId ? v.max - inApp : v.max - inApp - 1;
    if (v.external > lim) setV((x) => ({ ...x, external: Math.max(0, lim) }));
  }, [v.max]); // eslint-disable-line react-hooks/exhaustive-deps
  const [localTime, setLocalTime] = useState(() =>
    toLocalInput(v.startAt ? new Date(v.startAt) : new Date(Date.now() + 60 * 60_000)),
  );
  const busy = actions.create.isPending || actions.update.isPending;

  const submit = () => {
    if (!v.activity) {
      toast.error("Bitte wähle eine Aktivität.");
      return;
    }
    const input: CrewInput = {
      ...v,
      description: v.description.trim(),
      startAt: v.startMode === "time" ? new Date(localTime).toISOString() : null,
    };
    if (input.startMode === "time" && Number.isNaN(new Date(localTime).getTime())) {
      toast.error("Bitte wähle eine gültige Uhrzeit.");
      return;
    }
    if (editId)
      actions.update.mutate(
        { id: editId, input },
        {
          onSuccess: () => {
            toast.success("Crew-Suche aktualisiert");
            void nav({ to: "/crew/$id", params: { id: editId } });
          },
          onError: (e) => toast.error(crewError(e)),
        },
      );
    else
      actions.create.mutate(input, {
        onSuccess: (id) => {
          toast.success("Crew-Suche veröffentlicht");
          void nav({ to: "/crew/$id", params: { id } });
        },
        onError: (e) => toast.error(crewError(e)),
      });
  };

  return (
    <div className="pb-6">
      <CrewHero
        image={heroImg}
        left={
          <button
            type="button"
            aria-label="Zurück"
            data-testid="crew-form-back-button"
            onClick={() =>
              editId
                ? void nav({ to: "/crew/$id", params: { id: editId } })
                : void nav({ to: "/crew" })
            }
            className={glassBtn}
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        }
      />
      <div className="relative -mt-14 space-y-3 px-3">
        <div className={`${neonPanel} flex items-center justify-center gap-3 px-4 py-5`}>
          <Users className="h-10 w-10 text-[#FF7BE5] drop-shadow-[0_0_10px_rgba(255,79,216,0.9)]" />
          <h1
            data-testid="crew-form-title"
            className="font-display text-[1.9rem] leading-none text-white"
          >
            {editId ? "Crew-Suche bearbeiten" : "Neue Crew-Suche"}
          </h1>
        </div>

        <Section
          testId="crew-form-activity"
          icon={<Crosshair className="h-7 w-7" />}
          title="Aktivität"
        >
          <Select
            value={v.activity}
            onValueChange={(id) => {
              const a = activities.find((x) => x.id === id);
              setV((x) => ({
                ...x,
                activity: id,
                max: editId
                  ? Math.max(
                      x.max > (a?.max_limit ?? 4) ? (a?.max_limit ?? 4) : x.max,
                      inApp + x.external,
                    )
                  : (a?.default_max ?? 4),
              }));
            }}
          >
            <SelectTrigger data-testid="crew-form-activity-select" className={selectCls}>
              <SelectValue placeholder="Aktivität wählen" />
            </SelectTrigger>
            <SelectContent>
              {activities.map((a) => (
                <SelectItem key={a.id} value={a.id} data-testid={`crew-form-activity-${a.id}`}>
                  {a.emoji} {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Section>

        <Section
          testId="crew-form-platform"
          icon={<Gamepad2 className="h-7 w-7" />}
          title="Plattform"
        >
          <div className="grid grid-cols-2 gap-3">
            {PLATFORMS.map((p) => {
              const on = v.platform === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`crew-form-platform-${p.id}`}
                  aria-pressed={on}
                  onClick={() => setV((x) => ({ ...x, platform: p.id as Platform }))}
                  className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 text-lg font-semibold transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] ${on ? "border-[#FF7BE5] bg-[#3A0F4F] text-white shadow-[0_0_18px_rgba(255,79,216,0.55)]" : "border-[#B98BFF]/30 bg-[#140822]/80 text-white/80"}`}
                >
                  {p.label}
                  {on && (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[#FF9BEA] text-[#3A0F4F]">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          testId="crew-form-max"
          icon={<Users className="h-7 w-7" />}
          title="Maximale Spielerzahl"
        >
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {maxOptions
              .filter((n) => !editId || n >= inApp + 0)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  data-testid={`crew-form-max-${n}`}
                  onClick={() => setV((x) => ({ ...x, max: n }))}
                  className={numBtn(v.max === n)}
                >
                  {n}
                </button>
              ))}
          </div>
        </Section>

        <Section
          testId="crew-form-present"
          icon={<UserPlus className="h-7 w-7" />}
          title={`Bereits vorhandene Spieler (von ${v.max})`}
        >
          <div className="flex flex-wrap justify-center gap-3">
            {presentOptions.map((n) => (
              <button
                key={n}
                type="button"
                data-testid={`crew-form-present-${n}`}
                onClick={() => setV((x) => ({ ...x, external: n - inApp }))}
                className={numBtn(present === n)}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/55">
            {editId
              ? `Enthält ${inApp} Mitglied(er) mit App – der Rest sind Mitspieler ohne App-Konto.`
              : "Inklusive dir – weitere Spieler sind Mitspieler außerhalb der App."}
          </p>
        </Section>

        <Section testId="crew-form-language" icon={<Globe className="h-7 w-7" />} title="Sprache">
          <Select
            value={v.language}
            onValueChange={(l) => setV((x) => ({ ...x, language: l as Language }))}
          >
            <SelectTrigger data-testid="crew-form-language-select" className={selectCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Section>

        <Section
          testId="crew-form-headset"
          icon={<Headphones className="h-7 w-7" />}
          title="Headset erforderlich"
          right={
            <Switch
              data-testid="crew-form-headset-switch"
              checked={v.headset}
              onCheckedChange={(c) => setV((x) => ({ ...x, headset: c }))}
              className="h-8 w-14 data-[state=checked]:bg-[#FF2E97] [&>span]:h-7 [&>span]:w-7 data-[state=checked]:[&>span]:translate-x-6"
            />
          }
        />

        <Section
          testId="crew-form-start"
          icon={<CalendarClock className="h-7 w-7" />}
          title="Geplanter Start"
        >
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["now", "Jetzt"],
                ["later", "Später"],
                ["time", "Uhrzeit"],
              ] as [StartMode, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                data-testid={`crew-form-start-${id}`}
                onClick={() => setV((x) => ({ ...x, startMode: id }))}
                className={`min-h-12 rounded-2xl border-2 font-semibold transition-[background-color,border-color,box-shadow] duration-150 active:scale-95 ${v.startMode === id ? "border-[#FF7BE5] bg-[#3A0F4F] text-white shadow-[0_0_14px_rgba(255,79,216,0.5)]" : "border-[#B98BFF]/30 bg-[#140822]/80 text-white/80"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {v.startMode === "time" && (
            <input
              type="datetime-local"
              data-testid="crew-form-start-time"
              value={localTime}
              min={toLocalInput(new Date())}
              max={toLocalInput(new Date(Date.now() + 7 * 864e5))}
              onChange={(e) => setLocalTime(e.target.value)}
              className={`${selectCls} w-full [color-scheme:dark]`}
            />
          )}
          <p className="text-xs text-white/55">
            Die Suche läuft 6 Stunden nach dem geplanten Start automatisch ab
            {v.startMode !== "time" ? " (ohne feste Uhrzeit: 6 Stunden nach dem Erstellen)" : ""}.
          </p>
        </Section>

        <Section
          testId="crew-form-description"
          icon={<Pencil className="h-7 w-7" />}
          title="Beschreibung"
        >
          <textarea
            data-testid="crew-form-description-input"
            value={v.description}
            maxLength={500}
            rows={3}
            onChange={(e) => setV((x) => ({ ...x, description: e.target.value }))}
            placeholder="Entspannte Crew gesucht. Gemeinsam planen und loslegen!"
            className="w-full resize-none rounded-2xl border-2 border-[#FF7BE5]/45 bg-[#140822]/90 px-4 py-3 text-base leading-relaxed text-white outline-none placeholder:text-white/40 focus:border-[#FF7BE5]"
          />
          <p className="text-right text-[11px] text-white/45">{v.description.length}/500</p>
        </Section>

        <button
          type="button"
          data-testid="crew-form-submit"
          disabled={busy}
          onClick={submit}
          className="flex min-h-16 w-full items-center justify-center gap-3 rounded-full border-2 border-[#FFB36B]/80 bg-gradient-to-r from-[#FF7A2F] via-[#FF2E97] to-[#D61CFF] text-xl font-bold text-white shadow-[0_0_28px_rgba(255,110,80,0.6)] transition-[transform,opacity] duration-150 active:scale-[0.98] disabled:opacity-60"
        >
          <UserPlus className="h-7 w-7 text-[#FFE08A]" />
          {busy
            ? "Wird gespeichert …"
            : editId
              ? "Änderungen speichern"
              : "Eigene Crew-Suche erstellen"}
        </button>
      </div>
    </div>
  );
}
