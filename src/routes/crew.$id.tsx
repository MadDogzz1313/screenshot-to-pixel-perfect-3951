import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Gamepad2,
  Headphones,
  Lock,
  MessageSquareMore,
  MoreHorizontal,
  Send,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import {
  CrewHero,
  CrewMeta,
  Disclaimer,
  SlotGrid,
  SlotsPill,
  StartLine,
  ghostButton,
  glassBtn,
  neonPanel,
  pinkButton,
} from "@/components/crew/CrewUi";
import { ReportDialog } from "@/components/social/SocialProfile";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import lobbyImg from "@/assets/crew/lobby.webp";
import { DEFAULT_AVATAR } from "@/lib/db";
import { useStore } from "@/lib/store";
import { socialError, useSocialActions } from "@/lib/friends";
import {
  CREW_SETUP_HINT,
  crewError,
  expiryLabel,
  freeSlots,
  isFull,
  languageLabel,
  occupied,
  platformLabel,
  useCrewActions,
  useCrewDetail,
  useCrewMessages,
  useCrewRealtime,
  type Crew,
  type CrewMember,
} from "@/lib/crew";

export const Route = createFileRoute("/crew/$id")({
  head: () => ({
    meta: [{ title: "Crew-Lobby · Leonida Explorer" }, { name: "robots", content: "noindex" }],
  }),
  component: CrewPage,
});

type Confirm = { title: string; text: string; action: string; run: () => void } | null;
const hm = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function CrewPage() {
  const { id } = Route.useParams();
  const { user, authReady } = useStore();
  const detail = useCrewDetail(id, !!user);
  const back = (
    <Link
      to="/crew"
      aria-label="Zurück zum Crew Finder"
      data-testid="crew-lobby-back-button"
      className={glassBtn}
    >
      <ArrowLeft className="h-6 w-6" />
    </Link>
  );
  const shell = (body: React.ReactNode) => (
    <AppShell>
      <CrewHero image={lobbyImg} left={back} />
      <div className="relative -mt-10 px-3">{body}</div>
    </AppShell>
  );
  if (!authReady || (user && detail.isLoading))
    return shell(<div className={`${neonPanel} h-96 animate-pulse`} />);
  if (!user)
    return shell(
      <div className={`${neonPanel} p-5 text-center`}>
        <p className="font-semibold">Melde dich an, um Crews zu sehen.</p>
        <Link to="/" className={`${pinkButton} mt-3`}>
          Anmelden
        </Link>
      </div>,
    );
  if (detail.data === null)
    return shell(
      <p data-testid="crew-setup-hint" className={`${neonPanel} p-4 text-sm`}>
        {CREW_SETUP_HINT}
      </p>,
    );
  if (detail.isError || !detail.data)
    return shell(
      <div data-testid="crew-not-found" className={`${neonPanel} p-5 text-center`}>
        <p className="font-semibold">{crewError(detail.error)}</p>
        <Link to="/crew" className={`${ghostButton} mt-3`}>
          Zum Crew Finder
        </Link>
      </div>,
    );
  return <CrewLobby crew={detail.data} me={user.id} back={back} />;
}

function CrewLobby({ crew, me, back }: { crew: Crew; me: string; back: React.ReactNode }) {
  const nav = useNavigate();
  const actions = useCrewActions();
  const social = useSocialActions();
  const member = !!crew.my_role;
  const leader = crew.my_role === "leader";
  const admin = !!crew.viewer_is_admin;
  const live = !crew.expired;
  const full = isFull(crew);
  useCrewRealtime(crew.id, member);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [report, setReport] = useState(false);
  const [picked, setPicked] = useState<CrewMember | null>(null);
  const mine = crew.members.find((m) => m.user_id === me);
  const ok = (msg: string, after?: () => void) => ({
    onSuccess: () => {
      toast.success(msg);
      after?.();
    },
    onError: (e: unknown) => toast.error(crewError(e)),
  });
  const status = crew.expired
    ? "Abgelaufen – Lobby nur noch lesbar"
    : crew.status === "closed"
      ? "Suche geschlossen – Lobby bleibt offen"
      : full
        ? "Team steht – Vorbereitung & Start"
        : `Suche läuft – ${freeSlots(crew)} ${freeSlots(crew) === 1 ? "Platz" : "Plätze"} frei`;
  const readyCount = crew.members.filter((m) => m.ready).length;

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Crew-Aktionen"
        data-testid="crew-lobby-menu-button"
        className={glassBtn}
      >
        <MoreHorizontal className="h-6 w-6" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 border-[#FF4FD8]/40 bg-[#160A26] text-white">
        {leader && live && (
          <DropdownMenuItem
            data-testid="crew-menu-edit"
            onSelect={() => void nav({ to: "/crew/neu", search: { edit: crew.id } })}
          >
            Suche bearbeiten
          </DropdownMenuItem>
        )}
        {leader && live && crew.status === "open" && (
          <DropdownMenuItem
            data-testid="crew-menu-close"
            onSelect={() =>
              setConfirm({
                title: "Crew-Suche schließen?",
                text: "Niemand kann mehr beitreten, offene Anfragen werden abgelehnt. Lobby und Chat bleiben für die Crew bis zum Ablauf offen.",
                action: "Suche schließen",
                run: () => actions.close.mutate(crew.id, ok("Crew-Suche geschlossen")),
              })
            }
          >
            Suche schließen
          </DropdownMenuItem>
        )}
        {leader && (
          <DropdownMenuItem
            data-testid="crew-menu-delete"
            className="text-[#FF7B9C]"
            onSelect={() =>
              setConfirm({
                title: "Crew auflösen?",
                text: "Die Crew, ihre Lobby und der Chat werden endgültig gelöscht. Alle Mitglieder werden benachrichtigt.",
                action: "Crew auflösen",
                run: () =>
                  actions.remove.mutate(
                    crew.id,
                    ok("Crew aufgelöst", () => void nav({ to: "/crew" })),
                  ),
              })
            }
          >
            Crew auflösen
          </DropdownMenuItem>
        )}
        {member && !leader && (
          <DropdownMenuItem
            data-testid="crew-menu-leave"
            onSelect={() =>
              setConfirm({
                title: "Crew verlassen?",
                text: "Du verlässt die Lobby und den Crew-Chat. Der Crew-Leader wird benachrichtigt.",
                action: "Verlassen",
                run: () =>
                  actions.leave.mutate(
                    crew.id,
                    ok("Du hast die Crew verlassen", () => void nav({ to: "/crew" })),
                  ),
              })
            }
          >
            Crew verlassen
          </DropdownMenuItem>
        )}
        {!leader && (
          <DropdownMenuItem data-testid="crew-menu-report" onSelect={() => setReport(true)}>
            Crew-Suche melden
          </DropdownMenuItem>
        )}
        {admin && !leader && (
          <>
            <DropdownMenuSeparator />
            {crew.status === "open" && (
              <DropdownMenuItem
                data-testid="crew-menu-admin-close"
                onSelect={() =>
                  setConfirm({
                    title: "Als Admin schließen?",
                    text: "Die Suche wird geschlossen und im Moderationsprotokoll vermerkt.",
                    action: "Schließen",
                    run: () =>
                      actions.adminClose.mutate(
                        { id: crew.id, reason: "Moderation" },
                        ok("Crew-Suche moderiert"),
                      ),
                  })
                }
              >
                <ShieldAlert className="mr-2 h-4 w-4" />
                Admin: Suche schließen
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              data-testid="crew-menu-admin-delete"
              className="text-[#FF7B9C]"
              onSelect={() =>
                setConfirm({
                  title: "Als Admin löschen?",
                  text: "Die Crew wird endgültig entfernt und im Moderationsprotokoll vermerkt.",
                  action: "Löschen",
                  run: () =>
                    actions.remove.mutate(
                      crew.id,
                      ok("Crew-Suche gelöscht", () => void nav({ to: "/admin" })),
                    ),
                })
              }
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Admin: Crew löschen
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AppShell>
      <div className="pb-6">
        <CrewHero image={lobbyImg} left={back} right={menu} />
        <div className="relative -mt-12 space-y-4 px-3">
          <div className={`${neonPanel} flex items-center gap-3 p-3.5`}>
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-[#FF7BE5]/50 bg-[#1A0B2E] text-3xl shadow-[0_0_14px_rgba(255,79,216,0.35)]">
              {crew.activity_emoji}
            </span>
            <div className="min-w-0">
              <h1
                data-testid="crew-lobby-title"
                className="text-[1.45rem] font-bold leading-tight text-white"
              >
                {crew.activity_label} – Crew-Lobby
              </h1>
              <p data-testid="crew-lobby-status" className="text-[15px] text-[#D9C2FF]">
                {status}
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <SlotsPill crew={crew} size="lg" />
          </div>

          <SlotGrid
            crew={crew}
            size="lg"
            onMember={(m) => (m.user_id !== me ? setPicked(m) : undefined)}
          />

          <div
            data-testid="crew-lobby-info"
            className={`${neonPanel} grid grid-cols-[auto_1px_1fr] items-center gap-3 rounded-3xl px-4 py-3`}
          >
            <span
              data-testid="crew-lobby-count"
              className="flex items-center gap-2 text-lg font-semibold"
            >
              <Users className="h-6 w-6 fill-[#C79BFF] text-[#C79BFF]" />
              {occupied(crew)} / {crew.max_players} Spieler
            </span>
            <span className="h-8 bg-white/20" />
            <span className="flex items-center justify-end gap-2 text-right text-[15px] font-semibold text-[#7FE9FF]">
              <Gamepad2 className="h-6 w-6" />
              {platformLabel(crew.platform)} · {languageLabel(crew.language)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-[#CDB4F5]">
            <span className="flex items-center gap-1">
              <Headphones className="h-3.5 w-3.5" />
              {crew.headset_required ? "Headset erforderlich" : "Headset optional"}
            </span>
            <StartLine crew={crew} />
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {expiryLabel(crew)}
            </span>
            {member && (
              <span data-testid="crew-ready-count">
                {readyCount}/{crew.members.length} bereit
              </span>
            )}
          </div>
          {crew.description && (
            <p
              data-testid="crew-lobby-description"
              className="rounded-2xl border border-[#B98BFF]/25 bg-[#1C0C30]/70 p-3 text-sm leading-relaxed text-white/85"
            >
              {crew.description}
            </p>
          )}

          {leader && <JoinRequests crew={crew} />}

          {member ? <CrewChat crew={crew} me={me} /> : <NonMemberPanel crew={crew} />}

          {member && mine && (
            <button
              type="button"
              data-testid="crew-ready-button"
              disabled={!live || actions.ready.isPending}
              onClick={() =>
                actions.ready.mutate(
                  { id: crew.id, ready: !mine.ready },
                  { onError: (e) => toast.error(crewError(e)) },
                )
              }
              className={`flex min-h-[4.25rem] w-full items-center justify-center gap-3 rounded-full border-2 text-3xl font-bold transition-[transform,box-shadow,background-color] duration-150 active:scale-[0.98] disabled:opacity-50 ${mine.ready ? "border-[#3BFF8A] bg-[#0D3B22] text-white shadow-[0_0_26px_rgba(59,255,138,0.5)]" : "border-[#FF8BE8] bg-gradient-to-r from-[#FF2E97] to-[#D61CFF] text-white shadow-[0_0_30px_rgba(255,46,151,0.6)]"}`}
            >
              <Check className="h-9 w-9" strokeWidth={3} />
              {mine.ready ? "Du bist bereit" : "Bereit"}
            </button>
          )}
          {member && mine?.ready && (
            <p className="-mt-2 text-center text-xs text-white/55">
              Tippe erneut, um „nicht bereit“ zu setzen.
            </p>
          )}
          <Disclaimer />
        </div>
      </div>

      <MemberSheet
        crew={crew}
        member={picked}
        leader={leader}
        onClose={() => setPicked(null)}
        onKick={(m) =>
          setConfirm({
            title: `${m.username} entfernen?`,
            text: "Der Spieler verlässt Lobby und Crew-Chat und wird benachrichtigt.",
            action: "Entfernen",
            run: () =>
              actions.kick.mutate({ id: crew.id, userId: m.user_id }, ok(`${m.username} entfernt`)),
          })
        }
        onBlock={(m) =>
          setConfirm({
            title: `${m.username} blockieren?`,
            text: "Ihr seht gegenseitig keine Crew-Nachrichten mehr, Freundschaft und Anfragen werden entfernt.",
            action: "Blockieren",
            run: () =>
              social.block.mutate(m.user_id, {
                onSuccess: () => toast.success(`${m.username} blockiert`),
                onError: (e) => toast.error(socialError(e)),
              }),
          })
        }
      />
      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      >
        <AlertDialogContent
          data-testid="crew-confirm-dialog"
          className="border-[#FF4FD8]/40 bg-[#160A26]"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="crew-confirm-cancel">Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              data-testid="crew-confirm-ok"
              onClick={() => {
                confirm?.run();
                setConfirm(null);
              }}
              className="bg-[#FF2E97] text-white hover:bg-[#FF2E97]/90"
            >
              {confirm?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {report && (
        <ReportDialog
          open
          onOpenChange={(o) => {
            if (!o) setReport(false);
          }}
          targetId={crew.id}
          mode="crew"
          username={crew.activity_label}
        />
      )}
    </AppShell>
  );
}

function NonMemberPanel({ crew }: { crew: Crew }) {
  const actions = useCrewActions();
  const live = !crew.expired && crew.status === "open";
  const full = isFull(crew);
  return (
    <div className={`${neonPanel} space-y-3 p-4 text-center`}>
      <p className="flex items-center justify-center gap-2 text-sm text-white/75">
        <Lock className="h-4 w-4 text-[#FF7BE5]" />
        Lobby und Crew-Chat sind nur für Mitglieder sichtbar.
      </p>
      {crew.my_request === "pending" ? (
        <>
          <p data-testid="crew-request-pending" className="font-semibold text-[#FFC4F3]">
            Deine Anfrage liegt beim Crew-Leader.
          </p>
          <button
            type="button"
            data-testid="crew-cancel-request-button"
            onClick={() =>
              actions.cancelJoin.mutate(crew.id, {
                onSuccess: () => toast.success("Anfrage zurückgezogen"),
                onError: (e) => toast.error(crewError(e)),
              })
            }
            className={ghostButton}
          >
            Anfrage zurückziehen
          </button>
        </>
      ) : !live ? (
        <p className="font-semibold">Diese Crew-Suche nimmt keine Mitglieder mehr auf.</p>
      ) : full ? (
        <p data-testid="crew-full-note" className="font-semibold">
          Crew vollständig – aktuell kein Platz frei.
        </p>
      ) : (
        <button
          type="button"
          data-testid="crew-join-button"
          disabled={actions.requestJoin.isPending}
          onClick={() =>
            actions.requestJoin.mutate(crew.id, {
              onSuccess: () =>
                toast.success("Anfrage gesendet – der Crew-Leader wird benachrichtigt."),
              onError: (e) => toast.error(crewError(e)),
            })
          }
          className={`${pinkButton} w-full text-lg`}
        >
          Crew beitreten
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

function JoinRequests({ crew }: { crew: Crew }) {
  const { profiles } = useStore();
  const actions = useCrewActions();
  const list = crew.requests ?? [];
  return (
    <section data-testid="crew-requests" className={`${neonPanel} space-y-2 p-4`}>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Users className="h-5 w-5 text-[#FF7BE5]" />
        Beitrittsanfragen{" "}
        {list.length > 0 && (
          <span className="rounded-full bg-[#FF2E97] px-2 text-xs">{list.length}</span>
        )}
      </h2>
      {!list.length && <p className="text-sm text-white/60">Keine offenen Anfragen.</p>}
      {list.map((r) => {
        const p = profiles.find((x) => x.id === r.user_id);
        return (
          <div
            key={r.id}
            data-testid={`crew-request-${r.user_id}`}
            className="flex items-center gap-3 rounded-2xl border border-[#B98BFF]/25 bg-[#1A0B2E]/70 p-2.5"
          >
            <Link to="/u/$username" params={{ username: r.username }} className="shrink-0">
              <img
                src={p?.avatar ?? DEFAULT_AVATAR}
                alt=""
                className="h-11 w-11 rounded-xl border-2 border-[#FF7BE5] object-cover"
              />
            </Link>
            <span className="min-w-0 flex-1 truncate font-semibold">{r.username}</span>
            <button
              type="button"
              aria-label={`${r.username} annehmen`}
              data-testid={`crew-request-accept-${r.user_id}`}
              disabled={
                actions.respond.isPending || isFull(crew) || crew.status !== "open" || crew.expired
              }
              onClick={() =>
                actions.respond.mutate(
                  { requestId: r.id, accept: true },
                  {
                    onSuccess: () => toast.success(`${r.username} ist jetzt in der Crew`),
                    onError: (e) => toast.error(crewError(e)),
                  },
                )
              }
              className="grid h-11 w-11 place-items-center rounded-full bg-[#2BD46F] text-[#062312] shadow-[0_0_12px_rgba(59,255,138,0.5)] transition-transform active:scale-90 disabled:opacity-40"
            >
              <Check className="h-5 w-5" strokeWidth={3} />
            </button>
            <button
              type="button"
              aria-label={`${r.username} ablehnen`}
              data-testid={`crew-request-decline-${r.user_id}`}
              disabled={actions.respond.isPending}
              onClick={() =>
                actions.respond.mutate(
                  { requestId: r.id, accept: false },
                  {
                    onSuccess: () => toast.success("Anfrage abgelehnt"),
                    onError: (e) => toast.error(crewError(e)),
                  },
                )
              }
              className="grid h-11 w-11 place-items-center rounded-full border border-white/30 transition-transform active:scale-90 disabled:opacity-40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        );
      })}
      {isFull(crew) && list.length > 0 && (
        <p className="text-xs text-white/55">
          Die Crew ist vollständig – Anfragen können erst angenommen werden, wenn ein Platz frei
          wird.
        </p>
      )}
    </section>
  );
}

function CrewChat({ crew, me }: { crew: Crew; me: string }) {
  const { profiles } = useStore();
  const actions = useCrewActions();
  const msgs = useCrewMessages(crew.id, true);
  const [body, setBody] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const items = msgs.data ?? [];
  const lastId = items[items.length - 1]?.id;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);
  const names = new Map(crew.members.map((m) => [m.user_id, m.username]));
  const send = () => {
    const clean = body.trim();
    if (!clean || actions.send.isPending) return;
    actions.send.mutate(
      { id: crew.id, body: clean },
      { onSuccess: () => setBody(""), onError: (e) => toast.error(crewError(e)) },
    );
  };
  return (
    <section data-testid="crew-chat" className={`${neonPanel} p-3`}>
      <h2 className="flex items-center gap-2 px-1 pb-2 text-xl font-bold">
        <MessageSquareMore className="h-7 w-7 text-[#FF7BE5]" />
        Privater Crew-Chat
      </h2>
      <div
        ref={listRef}
        data-testid="crew-chat-list"
        className="max-h-[min(46vh,360px)] min-h-[120px] space-y-2 overflow-y-auto overscroll-contain pr-1"
      >
        {msgs.isError && <p className="p-2 text-sm text-white/70">{crewError(msgs.error)}</p>}
        {msgs.isSuccess && !items.length && (
          <p data-testid="crew-chat-empty" className="py-8 text-center text-sm text-white/55">
            Noch keine Nachrichten. Plant hier euer Treffen im Spiel.
          </p>
        )}
        {items.map((m) => {
          const p = profiles.find((x) => x.id === m.sender_id);
          const own = m.sender_id === me;
          return (
            <div
              key={m.id}
              data-testid={own ? "crew-chat-own" : "crew-chat-peer"}
              className="flex items-start gap-2.5"
            >
              <img
                src={p?.avatar ?? DEFAULT_AVATAR}
                alt=""
                className="mt-1 h-11 w-11 shrink-0 rounded-full border-2 border-[#FF7BE5]/80 object-cover"
              />
              <div
                className={`min-w-0 flex-1 rounded-2xl border px-3 py-2 ${own ? "border-[#FF4FD8]/45 bg-[#3A0F4F]/70" : "border-[#B98BFF]/20 bg-[#24123B]/80"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">
                    {names.get(m.sender_id) ?? p?.username ?? "Ehemaliges Mitglied"}
                  </span>
                  <time className="shrink-0 text-xs text-white/55">{hm(m.created_at)}</time>
                </div>
                <p
                  className={`whitespace-pre-wrap break-words text-[15px] ${m.deleted_at ? "italic text-white/45" : "text-white/90"}`}
                >
                  {m.deleted_at ? "Nachricht gelöscht" : m.body}
                </p>
                {own && !m.deleted_at && (
                  <button
                    type="button"
                    data-testid="crew-chat-delete"
                    onClick={() =>
                      actions.deleteMessage.mutate(m.id, {
                        onError: (e) => toast.error(crewError(e)),
                      })
                    }
                    className="mt-0.5 text-[11px] text-white/45 hover:text-[#FF9BEA]"
                  >
                    Löschen
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <textarea
          data-testid="crew-chat-input"
          value={body}
          maxLength={1000}
          rows={1}
          disabled={crew.expired}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={crew.expired ? "Lobby abgelaufen" : "Nachricht an die Crew …"}
          className="max-h-28 min-h-12 min-w-0 flex-1 resize-none rounded-2xl border-2 border-[#FF7BE5]/40 bg-[#140822]/90 px-3 py-2.5 text-base outline-none placeholder:text-white/40 focus:border-[#FF7BE5] disabled:opacity-50"
        />
        <button
          type="button"
          aria-label="Nachricht senden"
          data-testid="crew-chat-send"
          disabled={!body.trim() || actions.send.isPending || crew.expired}
          onClick={send}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-r from-[#FF2E97] to-[#D61CFF] text-white shadow-[0_0_16px_rgba(255,46,151,0.55)] transition-transform active:scale-90 disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}

function MemberSheet({
  crew,
  member,
  leader,
  onClose,
  onKick,
  onBlock,
}: {
  crew: Crew;
  member: CrewMember | null;
  leader: boolean;
  onClose: () => void;
  onKick: (m: CrewMember) => void;
  onBlock: (m: CrewMember) => void;
}) {
  const { profiles } = useStore();
  if (!member) return null;
  const p = profiles.find((x) => x.id === member.user_id);
  return (
    <div
      data-testid="crew-member-sheet"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`${neonPanel} mb-[max(env(safe-area-inset-bottom),1rem)] w-[min(96vw,28rem)] space-y-2 p-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 pb-1">
          <img
            src={p?.avatar ?? DEFAULT_AVATAR}
            alt=""
            className="h-14 w-14 rounded-2xl border-2 border-[#FF7BE5] object-cover"
          />
          <div>
            <p className="font-bold">{member.username}</p>
            <p className="text-xs text-white/60">
              {member.role === "leader" ? "Crew-Leader" : "Mitglied"} ·{" "}
              {member.ready ? "bereit" : "noch nicht bereit"} · {crew.activity_label}
            </p>
          </div>
        </div>
        <Link
          to="/u/$username"
          params={{ username: member.username }}
          data-testid="crew-member-profile"
          className={`${ghostButton} w-full`}
        >
          Profil ansehen
        </Link>
        {leader && member.role !== "leader" && (
          <button
            type="button"
            data-testid="crew-member-kick"
            onClick={() => {
              onClose();
              onKick(member);
            }}
            className={`${ghostButton} w-full`}
          >
            Aus der Crew entfernen
          </button>
        )}
        <button
          type="button"
          data-testid="crew-member-block"
          onClick={() => {
            onClose();
            onBlock(member);
          }}
          className={`${ghostButton} w-full text-[#FF9BB5]`}
        >
          Blockieren
        </button>
        <button
          type="button"
          data-testid="crew-member-sheet-close"
          onClick={onClose}
          className="w-full py-2 text-sm text-white/60"
        >
          Schließen
        </button>
      </div>
    </div>
  );
}
