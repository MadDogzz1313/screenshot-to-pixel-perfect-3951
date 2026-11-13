import { createFileRoute } from "@tanstack/react-router";
import { NeoshopView } from "@/components/arcade/NeoshopView";
import { tr } from "@/lib/i18n";

export const Route = createFileRoute("/neoshop")({
  head: () => ({ meta: [{ title: tr("Neoshop · Leonida Explorer") }, { name: "robots", content: "noindex" }, { name: "description", content: tr("Der Neon-Katalog von Leonida Explorer.") }] }),
  component: NeoshopView,
});
