// Kategorien & Typen. (Demo-Fundorte/-Profile entfernt – Daten kommen aus Lovable Cloud.)
import { Car, Crosshair, Gem, Flag, Building2, HelpCircle, type LucideIcon } from "lucide-react";

import { tr } from "@/lib/i18n";
export type CategoryId = "vehicle" | "weapon" | "collect" | "activity" | "place" | "other";
export const CATEGORIES: { id: CategoryId; label: string; icon: LucideIcon; color: string }[] = [
  { id: "vehicle", label: tr("Fahrzeuge"), icon: Car, color: "bg-cat-vehicle" },
  { id: "weapon", label: tr("Waffen"), icon: Crosshair, color: "bg-cat-weapon" },
  { id: "collect", label: tr("Sammelobjekte"), icon: Gem, color: "bg-cat-collect" },
  { id: "activity", label: tr("Aktivitäten"), icon: Flag, color: "bg-cat-activity" },
  { id: "place", label: tr("Orte & Gebäude"), icon: Building2, color: "bg-cat-place" },
  { id: "other", label: tr("Sonstiges"), icon: HelpCircle, color: "bg-cat-other" },
];
export const categoryById = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;

export type Status = "pending" | "approved" | "rejected" | "hidden";
export interface Profile {
  id: string; username: string; avatar: string; hasAvatar: boolean; avatarPath: string | null; bio: string; xp: number; likes: number;
  needsUsername?: boolean;
  /** privates Profil, das der Betrachter nicht voll sehen darf */
  restricted: boolean; isPrivate: boolean; joinedAt: string | null; featured: string[] | null;
  showAvatar: boolean; showJoinDate: boolean; showBadges: boolean; showFriends: boolean;
}
export interface Spot {
  id: string; title: string; category: CategoryId; x: number; y: number; area: string;
  vehicleType?: string | undefined; hour?: number | undefined; description: string; images: string[];
  author: string; authorId?: string; likes: number; status: Status; createdAt: string; accurate?: boolean;
}
