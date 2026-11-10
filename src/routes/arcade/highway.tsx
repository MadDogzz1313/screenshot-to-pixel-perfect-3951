import { createFileRoute } from "@tanstack/react-router";
import { NeonHighwayGame } from "@/components/arcade/games/NeonHighwayGame";

export const Route = createFileRoute("/arcade/highway")({
  head: () => ({ meta: [{ title: "Neon Highway · Leonida Explorer" }] }),
  component: NeonHighwayGame,
});
