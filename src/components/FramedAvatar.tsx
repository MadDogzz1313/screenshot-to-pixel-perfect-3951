import { frameById, FRAME_AVATAR_RATIO, type FrameId } from "@/lib/profile-frames";

/**
 * Rundes Profilbild mit optionalem animiertem Rahmen als eigene Ebene.
 * Das Bild bleibt unverändert; mit Rahmen wächst nur der äußere Platz, damit nichts überdeckt wird.
 * „Bewegung reduzieren“ → statisches Vorschaubild (per <picture>-Media-Query, ohne JS).
 */
export function FramedAvatar({ src, size, frameId, className = "", imgClassName = "", testId, frameTestId, alt = "" }: {
  src: string; size: number; frameId: FrameId | null | undefined; className?: string; imgClassName?: string; testId?: string; frameTestId?: string; alt?: string;
}) {
  const frame = frameById(frameId);
  const img = <img data-testid={testId} src={src} alt={alt} width={size} height={size} draggable={false} style={{ width: size, height: size }} className={`shrink-0 rounded-full object-cover ${imgClassName}`} />;
  if (!frame) return <span className={`inline-grid shrink-0 place-items-center ${className}`}>{img}</span>;
  const outer = Math.round(size / FRAME_AVATAR_RATIO);
  return (
    <span className={`relative inline-grid shrink-0 place-items-center ${className}`} style={{ width: outer, height: outer }}>
      {img}
      <picture className="pointer-events-none absolute inset-0">
        <source media="(prefers-reduced-motion: reduce)" srcSet={frame.still} />
        <img data-testid={frameTestId} data-frame={frame.id} src={frame.anim} alt="" aria-hidden width={outer} height={outer} draggable={false} decoding="async" className="h-full w-full select-none" />
      </picture>
    </span>
  );
}
