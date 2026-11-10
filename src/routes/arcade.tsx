import { createFileRoute } from "@tanstack/react-router";
import { ArcadeHub } from "@/components/arcade/ArcadeHub";

export const Route = createFileRoute("/arcade")({
  head: () => ({ meta: [{ title: "Neon Arcade · Leonida Explorer" }, { name: "description", content: "Spiele Neon Arcade, sammle Leonida Coins und Arcade-XP." }] }),
  component: ArcadeHub,
});
