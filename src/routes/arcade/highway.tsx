import { createFileRoute } from "@tanstack/react-router";
import { NeonHighwayGame } from "@/components/arcade/games/NeonHighwayGame";

export const Route = createFileRoute("/arcade/highway")({
  validateSearch: (s: Record<string, unknown>): { garage?: 1 } => (s["garage"] ? { garage: 1 } : {}),
  head: () => ({ meta: [{ title: "Neon Highway · Leonida Explorer" }] }),
  component: NeonHighwayGame,
});
