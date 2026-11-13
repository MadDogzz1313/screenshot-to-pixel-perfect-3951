// Fangvideos je Fischart. Weitere Videos: Datei nach public/videos/ legen und hier eintragen.
// Das Video ist reine Darstellung – Fang und Coins hat der Server zu diesem Zeitpunkt bereits gespeichert.
import type { SpeciesId } from "./fishing";

export type CatchVideoSpec = { src: string; poster: string; type: "video/mp4" };

export const CATCH_VIDEOS: Partial<Record<SpeciesId, CatchVideoSpec>> = {
  leonida_marlin: { src: "/videos/legendary-catch.mp4", poster: "/videos/legendary-catch-poster.jpg", type: "video/mp4" },
};

export const catchVideoFor = (species: SpeciesId | null | undefined) => (species ? CATCH_VIDEOS[species] : undefined);
