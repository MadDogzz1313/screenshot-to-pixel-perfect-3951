import { createFileRoute } from "@tanstack/react-router";
import { ArcadeHub } from "@/components/arcade/ArcadeHub";

import { tr } from "@/lib/i18n";
export const Route = createFileRoute("/arcade")({
  head: () => ({ meta: [{ title: "Neon Arcade · Leonida Explorer" }, { name: "description", content: tr("Spiele Neon Arcade, sammle Leonida Coins und Arcade-XP.") }] }),
  component: ArcadeHub,
});
