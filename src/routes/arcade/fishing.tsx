import { createFileRoute } from "@tanstack/react-router";
import { LeonidaFishingGame } from "@/components/arcade/games/LeonidaFishingGame";

export const Route = createFileRoute("/arcade/fishing")({
  head: () => ({ meta: [{ title: "Leonida Fishing · Leonida Explorer" }] }),
  component: LeonidaFishingGame,
});
