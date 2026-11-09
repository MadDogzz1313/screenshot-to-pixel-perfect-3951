// DEMO-DATEN: Platzhalter bis zur Lovable-Cloud-Anbindung. Nicht echt.
import { Car, Crosshair, Gem, Flag, Building2, HelpCircle, type LucideIcon } from "lucide-react";

export type CategoryId = "vehicle" | "weapon" | "collect" | "activity" | "place" | "other";
export const CATEGORIES: { id: CategoryId; label: string; icon: LucideIcon; color: string }[] = [
  { id: "vehicle", label: "Fahrzeuge", icon: Car, color: "bg-cat-vehicle" },
  { id: "weapon", label: "Waffen", icon: Crosshair, color: "bg-cat-weapon" },
  { id: "collect", label: "Sammelobjekte", icon: Gem, color: "bg-cat-collect" },
  { id: "activity", label: "Aktivitäten", icon: Flag, color: "bg-cat-activity" },
  { id: "place", label: "Orte & Gebäude", icon: Building2, color: "bg-cat-place" },
  { id: "other", label: "Sonstiges", icon: HelpCircle, color: "bg-cat-other" },
];
export const categoryById = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;

export type Status = "pending" | "approved" | "rejected" | "hidden";
export interface Profile { username: string; avatar: string; bio: string; xp: number; likes: number }
export interface Spot {
  id: string; title: string; category: CategoryId; x: number; y: number; area: string;
  vehicleType?: string | undefined; hour?: number | undefined; description: string; images: string[];
  author: string; likes: number; status: Status; createdAt: string;
}

const av = (seed: string) => `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}&backgroundColor=c026d3,f97316,7c3aed`;
const img = (seed: string) => `https://picsum.photos/seed/${seed}/800/500`;

export const DEMO_PROFILES: Profile[] = [
  { username: "ViceRider", avatar: av("ViceRider"), bio: "Jagt seltene Sportwagen in Vice City.", xp: 3420, likes: 812 },
  { username: "PalmQueen", avatar: av("PalmQueen"), bio: "Sammelobjekte & versteckte Strände.", xp: 1260, likes: 344 },
  { username: "KeysDiver", avatar: av("KeysDiver"), bio: "Unterwasser-Funde in den Keys.", xp: 420, likes: 97 },
  { username: "NeonNomad", avatar: av("NeonNomad"), bio: "Nachts unterwegs.", xp: 60, likes: 12 },
];

export const DEMO_SPOTS: Spot[] = [
  { id: "s1", title: "Pegassi Sportwagen", category: "vehicle", x: 76, y: 60, area: "Vice City Beach", vehicleType: "Supersportwagen", hour: 22, description: "Parkt nachts vor dem Hotel. Nach 22 Uhr hinter dem Pool prüfen, spawnt nicht bei Regen.", images: [img("car1"), img("car2")], author: "ViceRider", likes: 128, status: "approved", createdAt: "2026-10-30" },
  { id: "s2", title: "Pickup im Sumpf", category: "vehicle", x: 28, y: 30, area: "Grassrivers", vehicleType: "Pickup", hour: 7, description: "Morgens neben der Tankstelle, Schlüssel steckt.", images: [img("truck")], author: "PalmQueen", likes: 41, status: "approved", createdAt: "2026-10-28" },
  { id: "s3", title: "Versteckte Pistole", category: "weapon", x: 58, y: 18, area: "Ambrosia", description: "In der Scheune hinter dem Heuballen.", images: [img("barn")], author: "ViceRider", likes: 63, status: "approved", createdAt: "2026-10-25" },
  { id: "s4", title: "Muschel #12", category: "collect", x: 32, y: 47, area: "Port Gellhorn", description: "Am Ende des Stegs, nur bei Ebbe.", images: [img("shell")], author: "KeysDiver", likes: 22, status: "approved", createdAt: "2026-10-22" },
  { id: "s5", title: "Bootsrennen Start", category: "activity", x: 80, y: 36, area: "Leonida Keys Nord", description: "Startpunkt für das Bootsrennen.", images: [img("boat")], author: "PalmQueen", likes: 54, status: "approved", createdAt: "2026-10-20" },
  { id: "s6", title: "Penthouse Tower", category: "place", x: 68, y: 72, area: "Downtown Vice", description: "Begehbares Penthouse mit Heli-Pad.", images: [img("tower")], author: "ViceRider", likes: 90, status: "approved", createdAt: "2026-10-18" },
  { id: "s7", title: "Mysteriöses Signal", category: "other", x: 45, y: 82, area: "Keys Süd", description: "Funk-Signal nachts um 3 Uhr.", images: [img("radio")], author: "NeonNomad", likes: 8, status: "pending", createdAt: "2026-11-02" },
];
