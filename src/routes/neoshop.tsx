import { createFileRoute } from "@tanstack/react-router";
import { NeoshopView } from "@/components/arcade/NeoshopView";
import { tr } from "@/lib/i18n";

export type NeoshopSearch = { design?: string; from?: "garage" };

export const Route = createFileRoute("/neoshop")({
  validateSearch: (s: Record<string, unknown>): NeoshopSearch => ({
    ...(typeof s["design"] === "string" ? { design: s["design"] } : {}),
    ...(s["from"] === "garage" ? { from: "garage" as const } : {}),
  }),
  head: () => ({ meta: [{ title: tr("Neoshop · Leonida Explorer") }, { name: "robots", content: "noindex" }, { name: "description", content: tr("Der Neon-Katalog von Leonida Explorer.") }] }),
  component: NeoshopView,
});
