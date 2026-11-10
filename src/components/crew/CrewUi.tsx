import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Check, Crown, Gamepad2, Headphones, Palmtree, Plus, User, Users } from "lucide-react";
import { DEFAULT_AVATAR } from "@/lib/db";
import { useStore } from "@/lib/store";
import {
  freeSlots,
  isFull,
  languageLabel,
  occupied,
  platformLabel,
  startLabel,
  type Crew,
  type CrewMember,
} from "@/lib/crew";

export const glassBtn =
  "grid h-12 w-12 place-items-center rounded-2xl border border-[#FF4FD8]/45 bg-[#1A0B2E]/70 text-white shadow-[0_0_16px_rgba(255,79,216,0.25)] backdrop-blur-md transition-[transform,background-color] duration-150 active:scale-95 hover:bg-[#2A1145]/80";
export const neonPanel =
  "rounded-[1.75rem] border border-[#FF4FD8]/55 bg-gradient-to-b from-[#2A0F45]/90 to-[#170A2B]/95 shadow-[0_0_24px_rgba(255,79,216,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl";
export const pinkButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#FF8BE8]/70 bg-gradient-to-r from-[#FF2E97] to-[#D61CFF] px-5 font-bold text-white shadow-[0_0_22px_rgba(255,46,151,0.55)] transition-[transform,box-shadow,opacity] duration-150 active:scale-[0.97] hover:shadow-[0_0_30px_rgba(255,46,151,0.75)] disabled:opacity-50";
export const ghostButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#FF4FD8]/45 bg-[#1A0B2E]/60 px-4 text-sm font-semibold text-[#F6D8FF] transition-[transform,background-color] duration-150 active:scale-[0.97] hover:bg-[#2A1145] disabled:opacity-50";

/** Kopfbereich mit Miami-Sonnenuntergang, Palmen, Skyline und Leonida-Explorer-Logo */
export function CrewHero({
  image,
  left,
  right,
  children,
  tall,
}: {
  image: string;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  tall?: boolean;
}) {
  return (
    <header
      data-testid="crew-hero"
      className={`relative -mt-0 overflow-hidden ${tall ? "min-h-[330px]" : "min-h-[200px]"}`}
    >
      <img
        src={image}
        alt=""
        aria-hidden
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-[#12051F]/55 via-transparent to-[#12051F]"
      />
      <div className="relative flex items-start justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),0.9rem)]">
        <div className="w-12">{left}</div>
        <Logo />
        <div className="flex w-12 justify-end">{right}</div>
      </div>
      {children && <div className="relative px-4 pb-4 pt-[clamp(5rem,26vw,9rem)]">{children}</div>}
    </header>
  );
}

function Logo() {
  return (
    <Link
      to="/community"
      data-testid="crew-logo"
      className="flex items-center gap-1.5 select-none"
      aria-label="Leonida Explorer"
    >
      <Palmtree
        className="h-9 w-9 -rotate-6 text-[#FF7BE5] drop-shadow-[0_0_10px_rgba(255,79,216,0.9)]"
        strokeWidth={2.2}
      />
      <span className="font-display text-[1.35rem] italic leading-[0.95] tracking-wide text-white drop-shadow-[0_0_12px_rgba(255,79,216,0.85)]">
        LEONIDA
        <br />
        <span className="text-[#FFB8F0]">EXPLORER</span>
      </span>
    </Link>
  );
}

export function NeonUnderline() {
  return (
    <div
      aria-hidden
      className="mx-auto mt-2 h-[3px] w-40 rounded-full bg-gradient-to-r from-transparent via-[#38E8FF] to-transparent shadow-[0_0_12px_#38E8FF]"
    />
  );
}

export function SlotsPill({ crew, size = "md" }: { crew: Crew; size?: "md" | "lg" }) {
  const full = isFull(crew);
  const free = freeSlots(crew);
  const cls = size === "lg" ? "min-h-12 px-6 text-xl" : "min-h-8 px-3.5 text-sm";
  if (crew.expired || crew.status === "closed")
    return (
      <span
        data-testid="crew-status-pill"
        className={`inline-flex items-center rounded-full border border-white/25 bg-white/10 font-bold text-white/80 ${cls}`}
      >
        {crew.expired ? "Abgelaufen" : "Suche geschlossen"}
      </span>
    );
  return full ? (
    <span
      data-testid="crew-status-pill"
      className={`inline-flex items-center gap-2 rounded-full border-2 border-[#3BFF8A] bg-[#0D3B22]/80 font-bold text-white shadow-[0_0_18px_rgba(59,255,138,0.55)] ${cls}`}
    >
      <Check className={size === "lg" ? "h-6 w-6" : "h-4 w-4"} />
      Crew vollständig
    </span>
  ) : (
    <span
      data-testid="crew-status-pill"
      className={`inline-flex items-center rounded-full border-2 border-[#3BFF8A] bg-[#0D3B22]/80 font-bold text-white shadow-[0_0_14px_rgba(59,255,138,0.45)] ${cls}`}
    >
      {free} {free === 1 ? "Platz" : "Plätze"} frei
    </span>
  );
}

export function CrewMeta({ crew }: { crew: Crew }) {
  return (
    <div
      data-testid="crew-meta"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-[#B98BFF]/35 bg-[#1B0D30]/80 px-4 py-2 text-sm text-white/90"
    >
      <Gamepad2 className="h-5 w-5 text-[#E9D5FF]" />
      <span>{platformLabel(crew.platform)}</span>
      <span className="text-white/40">·</span>
      <span>{languageLabel(crew.language)}</span>
      <span className="text-white/40">·</span>
      <Headphones className="h-4 w-4 text-[#E9D5FF]" />
      <span>{crew.headset_required ? "Mit Headset" : "Headset optional"}</span>
    </div>
  );
}

/** Spieler-Kachel: Profilbild, Krone für den Leader, grüner Punkt = bereit */
export function MemberTile({
  member,
  size = "md",
  showName,
  onClick,
}: {
  member: CrewMember;
  size?: "md" | "lg";
  showName?: boolean;
  onClick?: (() => void) | undefined;
}) {
  const { profiles } = useStore();
  const p = profiles.find((x) => x.id === member.user_id);
  const leader = member.role === "leader";
  const ring = leader
    ? "border-[#FFC83D] shadow-[0_0_18px_rgba(255,200,61,0.6)]"
    : "border-[#FF7BE5] shadow-[0_0_14px_rgba(255,79,216,0.45)]";
  const body = (
    <span
      className={`relative block aspect-square w-full overflow-hidden rounded-2xl border-2 bg-[#2A1145] ${ring}`}
    >
      <img
        src={p?.avatar ?? DEFAULT_AVATAR}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      {showName && (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1 pb-1 pt-4 text-center text-[12px] font-bold leading-tight text-white">
          <span className="block truncate">{member.username}</span>
        </span>
      )}
      <span
        data-testid={`crew-member-ready-${member.user_id}`}
        aria-label={member.ready ? "bereit" : "nicht bereit"}
        className={`absolute bottom-1.5 right-1.5 h-3.5 w-3.5 rounded-full border-2 border-[#12051F] ${member.ready ? "bg-[#3BFF8A] shadow-[0_0_8px_#3BFF8A]" : "bg-white/35"}`}
      />
    </span>
  );
  return (
    <div data-testid={`crew-member-${member.user_id}`} className="relative min-w-0">
      {leader && (
        <Crown
          aria-label="Crew-Leader"
          className={`absolute left-1/2 z-10 -translate-x-1/2 fill-[#FFC83D] text-[#FFE08A] drop-shadow-[0_0_8px_rgba(255,200,61,0.9)] ${size === "lg" ? "-top-4 h-7 w-7" : "-top-3 h-5 w-5"}`}
        />
      )}
      {onClick ? (
        <button
          type="button"
          data-testid={`crew-member-button-${member.user_id}`}
          onClick={onClick}
          className="block w-full transition-transform duration-150 active:scale-95"
        >
          {body}
        </button>
      ) : (
        body
      )}
      {leader && size === "lg" && (
        <span className="relative mx-auto -mt-2 block w-fit whitespace-nowrap rounded-md border border-[#FFC83D]/80 bg-[#3A2A05] px-1.5 text-[10px] font-bold leading-4 text-[#FFC83D]">
          Crew-Leader
        </span>
      )}
    </div>
  );
}

export function ExternalTile() {
  return (
    <div
      data-testid="crew-external-tile"
      className="grid aspect-square w-full place-items-center rounded-2xl border-2 border-[#B98BFF]/60 bg-[#24123B] text-[#D9C2FF]"
    >
      <span className="flex flex-col items-center gap-1 text-[10px] font-semibold">
        <User className="h-6 w-6" />
        Mitspieler
      </span>
    </div>
  );
}
export function FreeTile() {
  return (
    <div
      data-testid="crew-free-tile"
      className="grid aspect-square w-full place-items-center rounded-2xl border-2 border-dashed border-[#FF7BE5]/70 bg-[#1A0B2E]/50 text-[#FF9BEA]"
    >
      <Plus className="h-8 w-8" />
    </div>
  );
}

/** Kacheln: Mitglieder, Mitspieler ohne App, freie Plätze (bei großen Gruppen gekürzt) */
export function SlotGrid({
  crew,
  size = "md",
  onMember,
}: {
  crew: Crew;
  size?: "md" | "lg";
  onMember?: (m: CrewMember) => void;
}) {
  const cap = 8;
  const total = crew.max_players;
  const tiles: ReactNode[] = [];
  crew.members.forEach((m) =>
    tiles.push(
      <MemberTile
        key={m.user_id}
        member={m}
        size={size}
        showName={size === "lg"}
        onClick={onMember ? () => onMember(m) : undefined}
      />,
    ),
  );
  for (let i = 0; i < crew.external_players; i++) tiles.push(<ExternalTile key={`ext-${i}`} />);
  for (let i = occupied(crew); i < total; i++) tiles.push(<FreeTile key={`free-${i}`} />);
  const shown = tiles.length > cap ? tiles.slice(0, cap - 1) : tiles;
  return (
    <div className={`grid grid-cols-4 ${size === "lg" ? "gap-2.5 pt-3" : "gap-3 pt-2"}`}>
      {shown}
      {tiles.length > cap && (
        <div className="grid aspect-square place-items-center rounded-2xl border-2 border-[#B98BFF]/50 bg-[#24123B] font-display text-lg text-[#E9D5FF]">
          +{tiles.length - cap + 1}
        </div>
      )}
    </div>
  );
}

export function PlayerCount({ crew }: { crew: Crew }) {
  return (
    <span
      data-testid="crew-player-count"
      className="inline-flex items-center gap-2 text-[15px] font-semibold text-white/90"
    >
      <Users className="h-5 w-5 text-[#E9D5FF]" />
      {occupied(crew)} von {crew.max_players} Spielern
    </span>
  );
}

export function StartLine({ crew }: { crew: Crew }) {
  return (
    <span data-testid="crew-start" className="text-xs text-[#CDB4F5]">
      {startLabel(crew)}
    </span>
  );
}

export const Disclaimer = () => (
  <p
    data-testid="crew-disclaimer"
    className="px-2 text-center text-[11px] leading-relaxed text-white/55"
  >
    Der Crew Finder organisiert nur Mitspieler. Ihr trefft euch anschließend selbst im Spiel – die
    App startet keine Aktivitäten in GTA VI.
  </p>
);
