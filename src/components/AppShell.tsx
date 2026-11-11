import { Link } from "@tanstack/react-router";
import { Gamepad2, Map, Compass, PlusCircle, Users, User } from "lucide-react";
import type { ReactNode } from "react";
import bg from "@/assets/bg-sunset.jpg";

import { tr } from "@/lib/i18n";
const NAV = [
  { to: "/karte", label: tr("Karte"), icon: Map },
  { to: "/entdecken", label: tr("Entdecken"), icon: Compass },
  { to: "/arcade", label: "Arcade", icon: Gamepad2 },
  { to: "/beitrag", label: tr("Beitrag"), icon: PlusCircle },
  { to: "/community", label: "Community", icon: Users },
  { to: "/profil", label: tr("Profil"), icon: User },
] as const;

export function AppShell({ children, title, vividBg, headerRight }: { children: ReactNode; title?: string; vividBg?: boolean; headerRight?: ReactNode }) {
  return (
    <div className="relative isolate mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <img src={bg} alt="" aria-hidden className={`pointer-events-none fixed inset-0 -z-10 h-full w-full object-cover ${vividBg ? "opacity-90" : "opacity-60"}`} />
      <div className={`pointer-events-none fixed inset-0 -z-10 ${vividBg ? "bg-gradient-to-b from-background/70 via-background/25 to-background/60" : "bg-background/60"}`} />
      {title && (
        <header className="flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-2">
          <h1 className="font-display text-2xl text-neon-gradient">{title}</h1>
          {headerRight}
        </header>
      )}
      <main className="flex-1 pb-24">{children}</main>
      <div data-testid="app-bottom-nav" className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-3xl">
        <nav className="safe-bottom grid grid-cols-6 border-t border-neon bg-background/95 pt-2 backdrop-blur">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} data-testid={`app-nav-${label.toLowerCase()}`} className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground"
              activeProps={{ className: "text-neon [&_svg]:drop-shadow-[0_0_6px_var(--neon)]" }}>
              <Icon className="h-6 w-6" />{label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
