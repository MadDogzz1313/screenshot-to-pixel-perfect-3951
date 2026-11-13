import { ANIMATED_BADGES, badgeImg } from "@/lib/badges";

/** Badge-Bild; animierte Badges zeigen bei „Bewegung reduzieren“ ein Standbild (ohne JS, per <picture>). */
export function BadgeImg({ id, alt, className, loading, testId }: { id: string; alt: string; className?: string; loading?: "lazy" | "eager"; testId?: string }) {
  const img = <img data-testid={testId} src={badgeImg(id)} alt={alt} loading={loading} decoding="async" className={className} />;
  if (!ANIMATED_BADGES.has(id)) return img;
  return <picture><source media="(prefers-reduced-motion: reduce)" srcSet={`/badges/${id}-static.webp`} />{img}</picture>;
}
