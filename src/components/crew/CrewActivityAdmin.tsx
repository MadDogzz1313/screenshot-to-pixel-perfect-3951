import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  CREW_SETUP_HINT,
  crewError,
  useAdminCrewActivities,
  useCrewActivities,
  type CrewActivity,
} from "@/lib/crew";

const EMPTY: CrewActivity = {
  id: "",
  label: "",
  emoji: "🎮",
  default_max: 4,
  max_limit: 4,
  sort: 100,
  active: true,
};
const chip = "min-h-9 rounded-full px-3 text-xs font-semibold";

/** Admin: Crew-Finder-Aktivitäten und Gruppengrößen pflegen (z. B. sobald GTA-VI-Online-Modi bekannt sind) */
export function CrewActivityAdmin() {
  const list = useCrewActivities(true);
  const save = useAdminCrewActivities();
  const [draft, setDraft] = useState<CrewActivity | null>(null);
  const isNew = !!draft && !(list.data ?? []).some((a) => a.id === draft.id);
  const submit = () =>
    draft &&
    save.mutate(
      { ...draft, id: draft.id.trim().toLowerCase() },
      {
        onSuccess: () => {
          toast.success("Aktivität gespeichert");
          setDraft(null);
        },
        onError: (e) => toast.error(crewError(e)),
      },
    );
  const num = (k: "default_max" | "max_limit" | "sort", label: string) => (
    <label className="grid gap-1 text-[11px] text-muted-foreground">
      {label}
      <Input
        type="number"
        inputMode="numeric"
        data-testid={`admin-crew-activity-${k}`}
        value={draft?.[k] ?? 0}
        onChange={(e) => setDraft((d) => d && { ...d, [k]: Number(e.target.value) })}
        className="text-base"
      />
    </label>
  );
  return (
    <section data-testid="admin-crew-activities" className="neon-card space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display">Crew Finder – Aktivitäten</h2>
        <button
          type="button"
          data-testid="admin-crew-activity-new"
          onClick={() => setDraft({ ...EMPTY })}
          className={`${chip} bg-primary text-primary-foreground`}
        >
          Neue Aktivität
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Aktivitäten und maximale Gruppengrößen sind hier anpassbar. Bitte nur bestätigte Spielmodi
        eintragen.
      </p>
      {list.data === null && <p className="text-xs text-muted-foreground">{CREW_SETUP_HINT}</p>}
      {list.data?.map((a) => (
        <div
          key={a.id}
          data-testid={`admin-crew-activity-${a.id}`}
          className="flex items-center gap-2 rounded-xl border border-border p-2 text-sm"
        >
          <span className="text-xl">{a.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{a.label}</span>
            <span className="text-[11px] text-muted-foreground">
              {a.id} · Standard {a.default_max} · max. {a.max_limit} Spieler
              {a.active ? "" : " · ausgeblendet"}
            </span>
          </span>
          <button
            type="button"
            data-testid={`admin-crew-activity-edit-${a.id}`}
            onClick={() => setDraft({ ...a })}
            className={`${chip} border border-border`}
          >
            Bearbeiten
          </button>
        </div>
      ))}
      {draft && (
        <div
          data-testid="admin-crew-activity-form"
          className="space-y-2 rounded-xl border border-neon/50 p-3"
        >
          <div className="grid grid-cols-[1fr_4.5rem] gap-2">
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Name
              <Input
                data-testid="admin-crew-activity-label"
                value={draft.label}
                maxLength={40}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                className="text-base"
              />
            </label>
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Emoji
              <Input
                data-testid="admin-crew-activity-emoji"
                value={draft.emoji}
                maxLength={8}
                onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
                className="text-base"
              />
            </label>
          </div>
          {isNew && (
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Kennung (a–z, 0–9, _)
              <Input
                data-testid="admin-crew-activity-id"
                value={draft.id}
                maxLength={32}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  })
                }
                className="text-base"
              />
            </label>
          )}
          <div className="grid grid-cols-3 gap-2">
            {num("default_max", "Standard")}
            {num("max_limit", "Maximum")}
            {num("sort", "Reihenfolge")}
          </div>
          <label className="flex items-center justify-between text-sm">
            Im Crew Finder anzeigen
            <Switch
              data-testid="admin-crew-activity-active"
              checked={draft.active}
              onCheckedChange={(c) => setDraft({ ...draft, active: c })}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="admin-crew-activity-save"
              disabled={save.isPending}
              onClick={submit}
              className={`${chip} bg-primary text-primary-foreground`}
            >
              Speichern
            </button>
            <button
              type="button"
              data-testid="admin-crew-activity-cancel"
              onClick={() => setDraft(null)}
              className={`${chip} border border-border`}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
