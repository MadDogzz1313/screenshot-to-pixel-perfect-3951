// Fangvideos je Fischart. Weitere Videos: Datei nach public/videos/ legen und hier eintragen.
// Das Video ist reine Darstellung – Fang und Coins hat der Server zu diesem Zeitpunkt bereits gespeichert.
import type { SpeciesId } from "./fishing";

export type CatchVideoSpec = { src: string; poster: string; type: "video/mp4"; /** Videolänge in ms – danach spätestens Belohnung */ durationMs: number };

export const CATCH_VIDEOS: Partial<Record<SpeciesId, CatchVideoSpec>> = {
  leonida_marlin: { src: "/videos/legendary-catch.mp4", poster: "/videos/legendary-catch-poster.jpg", type: "video/mp4", durationMs: 10_000 },
  mythic_marlin: { src: "/videos/mythic-catch.mp4", poster: "/videos/mythic-catch-poster.jpg", type: "video/mp4", durationMs: 25_000 },
};

export const catchVideoFor = (species: SpeciesId | null | undefined) => (species ? CATCH_VIDEOS[species] : undefined);

/** Neon Highway: kurzer Film beim Start jeder Polizeijagd (Video des Nutzers, 2 s, 9:16). */
export const POLICE_CHASE_VIDEO: CatchVideoSpec = { src: "/videos/police-chase.mp4", poster: "/videos/police-chase-poster.jpg", type: "video/mp4", durationMs: 2_000 };
