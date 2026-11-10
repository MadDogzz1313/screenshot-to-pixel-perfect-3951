import { useUsernameAvailability, USERNAME_HINT, validateUsername } from "@/lib/username";

export function UsernameField({
  value,
  onChange,
  excludeId,
  inputTestId,
  label = "Benutzername",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  excludeId?: string | null;
  inputTestId: string;
  label?: string;
  disabled?: boolean;
}) {
  const clean = value.trim();
  const validationError = clean ? validateUsername(clean) : null;
  const availability = useUsernameAvailability(value, excludeId);
  const status = !clean ? null : validationError ? "invalid" : availability.isPending ? "checking" : availability.isError ? "error" : availability.data ? "available" : "taken";
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputTestId} className="block text-sm font-semibold">{label}</label>
      <input
        id={inputTestId}
        data-testid={inputTestId}
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, 20))}
        maxLength={20}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        placeholder="z. B. Leonida_Explorer"
        className="min-h-12 w-full rounded-xl border border-neon/40 bg-background/60 px-3 text-base outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus:border-neon focus:shadow-[0_0_14px_oklch(0.7_0.3_345/0.22)] disabled:opacity-60"
      />
      <div data-testid={`${inputTestId}-status`} aria-live="polite" className="min-h-4 text-xs">
        {status === "available" && <span className="font-semibold text-success">Verfügbar ✓</span>}
        {status === "taken" && <span className="font-semibold text-destructive">Bereits vergeben</span>}
        {status === "invalid" && <span className="text-destructive">{validationError}</span>}
        {status === "checking" && <span className="text-muted-foreground">Prüfe Verfügbarkeit …</span>}
        {status === "error" && <span className="text-muted-foreground">Prüfung momentan nicht möglich. SQL 012 muss zuerst ausgeführt werden.</span>}
        {!status && <span className="text-muted-foreground">{USERNAME_HINT}</span>}
      </div>
    </div>
  );
}
