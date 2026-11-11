import { Link } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { useStore } from "@/lib/store";

import { tr } from "@/lib/i18n";
/** Nicht blockierend: ältere Konten dürfen weiterarbeiten und werden an die Profilergänzung erinnert. */
export function UsernameReminder() {
  const { user } = useStore();
  if (!user?.needsUsername) return null;
  return (
    <div data-testid="username-reminder" className="sticky top-0 z-40 flex items-center gap-3 border-b border-neon/35 bg-[#160E22]/95 px-4 py-2.5 text-xs shadow-[0_4px_20px_rgba(255,46,147,0.12)] backdrop-blur-xl">
      <UserRound className="h-4 w-4 shrink-0 text-neon" />
      <p className="min-w-0 flex-1">{tr("Wähle jetzt deinen Benutzernamen, damit dich andere erkennen.")}</p>
      <Link to="/profil" data-testid="username-reminder-link" className="shrink-0 rounded-full bg-primary px-3 py-1.5 font-bold text-primary-foreground transition-transform duration-150 active:scale-95">{tr("Jetzt wählen")}</Link>
    </div>
  );
}
