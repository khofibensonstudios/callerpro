"use client";

import { useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { Heart, Users, X, Check, UserPlus, Power, Send, Share2 } from "lucide-react";
import { Avatar } from "./Avatar";
import { EmojiComposerButton } from "./EmojiPicker";
import { LIVE_JOIN_MARKER, encodeLiveInvite } from "@/lib/live-shared";
import type { LiveComment, LiveSession } from "@/lib/live";
import { LIVE_MAX_GUESTS } from "@/lib/live-shared";

type FloatHeart = { id: string; x: number; y: number; delay: number; size: number };
type LiveMe = { id: string; name: string; avatarHue: number; avatarUrl?: string } | null;
type SharePerson = {
  other: { id: string; name: string; avatarHue: number; avatarUrl?: string };
  thread: { id: string } | null;
};
type GuestRow = {
  sessionId: string;
  userId: string;
  status: "requested" | "accepted" | "rejected";
  user?: { id: string; name: string; avatarHue: number; avatarUrl?: string };
};

function stopLike(e: SyntheticEvent) {
  e.stopPropagation();
}

function LiveShareIcon({ className }: { className?: string }) {
  return <Share2 className={className} strokeWidth={2.25} aria-hidden />;
}

export function LiveStageChrome({
  sessionId,
  session,
  me,
  role,
  onClose,
  onEnd,
  hostControls,
  onGuestStatus,
  onInteract,
  guestTiles,
  onSpotlightPeer,
}: {
  sessionId: string;
  session: LiveSession;
  me: LiveMe;
  role: "host" | "viewer";
  onClose: () => void;
  onEnd?: () => void;
  hostControls?: ReactNode;
  onGuestStatus?: (status: "off" | "requested" | "accepted" | "rejected") => void;
  onInteract?: () => void;
  guestTiles?: ReactNode;
  onSpotlightPeer?: (peer: string | null) => void;
}) {
  const router = useRouter();
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [hearts, setHearts] = useState(0);
  const [floats, setFloats] = useState<FloatHeart[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [hostSheet, setHostSheet] = useState(false);
  const [profileSheet, setProfileSheet] = useState<{
    id: string;
    name: string;
    avatarHue: number;
    avatarUrl?: string;
    headline?: string;
  } | null>(null);
  const [profileMeta, setProfileMeta] = useState<{
    followers: number;
    following: number;
    youFollow: boolean;
  } | null>(null);
  const [people, setPeople] = useState<SharePerson[]>([]);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [shareBusy, setShareBusy] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [guestSheet, setGuestSheet] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [hostMeta, setHostMeta] = useState<{
    followers: number;
    following: number;
    youFollow: boolean;
  } | null>(null);
  const afterRef = useRef("");
  const listRef = useRef<HTMLDivElement>(null);
  const heartBurst = useRef(0);
  const lastTap = useRef(0);
  const knownHearts = useRef(-1);
  const tapPoint = useRef({ x: 50, y: 50 });
  const [kbOffset, setKbOffset] = useState(0);
  const prevPending = useRef(0);
  const onSpotlightRef = useRef(onSpotlightPeer);
  onSpotlightRef.current = onSpotlightPeer;

  function applyGuestPayload(gData: { guests?: GuestRow[]; spotlightPeer?: string | null }) {
    setGuests((gData.guests || []) as GuestRow[]);
    if ("spotlightPeer" in gData) {
      onSpotlightRef.current?.(gData.spotlightPeer ?? null);
    }
  }

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbOffset(offset > 40 ? offset : 0);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  useEffect(() => {
    if (!me) return;
    const mine = guests.find((g) => g.userId === me.id);
    if (!mine) {
      onGuestStatus?.("off");
      return;
    }
    onGuestStatus?.(mine.status);
  }, [guests, me, onGuestStatus]);

  useEffect(() => {
    if (role !== "host") return;
    const pending = guests.filter((g) => g.status === "requested").length;
    if (pending > prevPending.current && pending > 0) {
      // Badge only — do not auto-open the requests sheet.
      setToast(`${pending} guest request${pending > 1 ? "s" : ""}`);
      window.setTimeout(() => setToast(""), 1800);
    }
    prevPending.current = pending;
  }, [guests, role]);

  useEffect(() => {
    let stop = false;
    async function boot() {
      const [cRes, hRes, gRes] = await Promise.all([
        fetch(`/api/live/${sessionId}/comments`, { credentials: "include" }),
        fetch(`/api/live/${sessionId}/hearts`, { credentials: "include" }),
        fetch(`/api/live/${sessionId}/guests`, { credentials: "include" }),
      ]);
      if (stop) return;
      const cData = await cRes.json().catch(() => ({}));
      const hData = await hRes.json().catch(() => ({}));
      const gData = await gRes.json().catch(() => ({}));
      const list: LiveComment[] = cData.comments || [];
      setComments(list);
      if (list.length) afterRef.current = list[list.length - 1].createdAt;
      const count = Number(hData.count) || 0;
      knownHearts.current = count;
      setHearts(count);
      applyGuestPayload(gData);
    }
    void boot();

    async function poll() {
      while (!stop) {
        try {
          const q = afterRef.current ? `?after=${encodeURIComponent(afterRef.current)}` : "";
          const [cRes, hRes, gRes] = await Promise.all([
            fetch(`/api/live/${sessionId}/comments${q}`, { credentials: "include" }),
            fetch(`/api/live/${sessionId}/hearts`, { credentials: "include" }),
            fetch(`/api/live/${sessionId}/guests`, { credentials: "include" }),
          ]);
          const cData = await cRes.json().catch(() => ({}));
          const hData = await hRes.json().catch(() => ({}));
          const gData = await gRes.json().catch(() => ({}));
          applyGuestPayload(gData);
          const incoming: LiveComment[] = cData.comments || [];
          if (incoming.length) {
            setComments((prev) => {
              const ids = new Set(prev.map((c) => c.id));
              const merged = [...prev, ...incoming.filter((c) => !ids.has(c.id))];
              return merged.slice(-80);
            });
            afterRef.current = incoming[incoming.length - 1].createdAt;
          }
          const nextHearts = Number(hData.count) || 0;
          if (nextHearts > knownHearts.current) {
            if (knownHearts.current >= 0) spawnHearts(Math.min(5, nextHearts - knownHearts.current));
            knownHearts.current = nextHearts;
            setHearts(nextHearts);
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    void poll();
    return () => {
      stop = true;
    };
  }, [sessionId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  function spawnHearts(n = 1, at?: { x: number; y: number }) {
    const batch: FloatHeart[] = [];
    const baseX = at?.x ?? 72;
    const baseY = at?.y ?? 58;
    for (let i = 0; i < n; i++) {
      heartBurst.current += 1;
      batch.push({
        id: `fh_${heartBurst.current}`,
        x: Math.min(92, Math.max(8, baseX + (Math.random() * 18 - 9))),
        y: Math.min(75, Math.max(25, baseY + (Math.random() * 10 - 5))),
        delay: Math.random() * 100,
        size: 22 + Math.random() * 16,
      });
    }
    setFloats((prev) => [...prev, ...batch].slice(-28));
    window.setTimeout(() => {
      setFloats((prev) => prev.filter((f) => !batch.some((b) => b.id === f.id)));
    }, 1600);
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/live/${sessionId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.comment) {
        setDraft("");
        setComments((prev) => [...prev, data.comment].slice(-80));
        afterRef.current = data.comment.createdAt;
      }
    } finally {
      setSending(false);
    }
  }

  function likeOnce(clientX?: number, clientY?: number) {
    const w = typeof window !== "undefined" ? window.innerWidth : 390;
    const h = typeof window !== "undefined" ? window.innerHeight : 844;
    const at =
      clientX != null && clientY != null
        ? { x: (clientX / w) * 100, y: (clientY / h) * 100 }
        : tapPoint.current;
    spawnHearts(3, at);
    setHearts((n) => {
      const next = n + 1;
      knownHearts.current = Math.max(knownHearts.current, next);
      return next;
    });
    void fetch(`/api/live/${sessionId}/hearts`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ by: 1 }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.count === "number") {
          knownHearts.current = data.count;
          setHearts(data.count);
        }
      })
      .catch(() => {});
  }

  function onTapLayer(e: React.PointerEvent<HTMLDivElement>) {
    // Only like when tapping empty stage — never steal mic/cam/UI taps.
    if (e.target !== e.currentTarget) return;
    onInteract?.();
    tapPoint.current = {
      x: (e.clientX / window.innerWidth) * 100,
      y: (e.clientY / window.innerHeight) * 100,
    };
    const now = Date.now();
    if (now - lastTap.current < 380) {
      lastTap.current = 0;
      likeOnce(e.clientX, e.clientY);
      return;
    }
    lastTap.current = now;
  }

  async function openShare() {
    setShareOpen(true);
    const [inboxRes, creatorsRes, friendsRes] = await Promise.all([
      fetch("/api/inbox", { credentials: "include" }),
      fetch("/api/creators", { credentials: "include" }),
      fetch("/api/friends", { credentials: "include" }),
    ]);
    const inboxData = await inboxRes.json().catch(() => ({}));
    const creatorsData = await creatorsRes.json().catch(() => ({}));
    const friendsData = await friendsRes.json().catch(() => ({}));

    const followingIds = new Set<string>([
      ...((friendsData.following as string[]) || []),
      ...((friendsData.followers as string[]) || []),
    ]);

    const byId = new Map<string, SharePerson>();

    for (const it of (inboxData.items || []) as Array<{
      kind?: string;
      other: SharePerson["other"];
      threadId?: string;
    }>) {
      if (!it.other?.id || it.other.id === me?.id) continue;
      byId.set(it.other.id, {
        other: it.other,
        thread: it.threadId ? { id: it.threadId } : null,
      });
    }

    for (const c of (creatorsData.creators || []) as SharePerson["other"][]) {
      if (!c?.id || c.id === me?.id) continue;
      if (!byId.has(c.id)) byId.set(c.id, { other: c, thread: null });
    }

    // Prefer people you follow / who follow you, then anyone else
    const all = [...byId.values()];
    all.sort((a, b) => {
      const af = followingIds.has(a.other.id) ? 0 : 1;
      const bf = followingIds.has(b.other.id) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.other.name.localeCompare(b.other.name);
    });
    setPeople(all.slice(0, 60));
  }

  async function openHostSheet() {
    if (!session.host) return;
    setProfileSheet({
      id: session.host.id,
      name: session.host.name,
      avatarHue: session.host.avatarHue,
      avatarUrl: session.host.avatarUrl,
      headline: session.host.headline,
    });
    setHostSheet(true);
    const res = await fetch(`/api/users/${session.host.id}`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    setProfileMeta({
      followers: Number(data.followers) || 0,
      following: Number(data.following) || 0,
      youFollow: Boolean(data.youFollow),
    });
  }

  async function openUserSheet(user: {
    id: string;
    name: string;
    avatarHue: number;
    avatarUrl?: string;
    headline?: string;
  }) {
    setProfileSheet({
      id: user.id,
      name: user.name,
      avatarHue: user.avatarHue,
      avatarUrl: user.avatarUrl,
      headline: user.headline,
    });
    setHostSheet(true);
    setProfileMeta(null);
    const res = await fetch(`/api/users/${user.id}`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    setProfileMeta({
      followers: Number(data.followers) || 0,
      following: Number(data.following) || 0,
      youFollow: Boolean(data.youFollow),
    });
  }

  async function toggleFollowProfile() {
    if (!profileSheet || !me || profileSheet.id === me.id) return;
    const res = await fetch("/api/friends", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profileSheet.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setProfileMeta((m) =>
        m
          ? {
              ...m,
              youFollow: Boolean(data.following ?? !m.youFollow),
              followers: Math.max(0, m.followers + (data.following ? 1 : -1)),
            }
          : m,
      );
      if (session.host?.id === profileSheet.id) {
        setHostMeta((m) =>
          m
            ? {
                ...m,
                youFollow: Boolean(data.following ?? !m.youFollow),
                followers: Math.max(0, m.followers + (data.following ? 1 : -1)),
              }
            : m,
        );
      }
    }
  }

  async function toggleFollowHost() {
    if (!session.host || role !== "viewer") return;
    const res = await fetch("/api/friends", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.host.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setHostMeta((m) =>
        m
          ? {
              ...m,
              youFollow: Boolean(data.following),
              followers: Math.max(0, m.followers + (data.following ? 1 : -1)),
            }
          : m,
      );
    }
  }

  function goToHostProfile() {
    if (!profileSheet) return;
    router.push(`/u/${profileSheet.id}`);
  }

  async function requestGuest() {
    if (!me || guestBusy || role !== "viewer") return;
    setGuestBusy(true);
    try {
      const res = await fetch(`/api/live/${sessionId}/guests`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(data.error || "Couldn't request");
        window.setTimeout(() => setToast(""), 1600);
        return;
      }
      if (data.guest) {
        setGuests((prev) => {
          const rest = prev.filter((g) => g.userId !== me.id);
          return [...rest, data.guest as GuestRow];
        });
      }
      setToast(data.guest?.status === "requested" ? "Request sent — waiting for host" : "Request sent");
      window.setTimeout(() => setToast(""), 2200);
    } finally {
      setGuestBusy(false);
    }
  }

  async function resolveGuest(userId: string, status: "accepted" | "rejected") {
    if (role !== "host" || guestBusy) return;
    const onStage = guests.filter((g) => g.status === "accepted").length;
    if (status === "accepted" && onStage >= LIVE_MAX_GUESTS) {
      setToast("Stage is packed (12/12) — drop someone first");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }
    setGuestBusy(true);
    try {
      const res = await fetch(`/api/live/${sessionId}/guests`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(data.error || "Couldn't update guest");
        window.setTimeout(() => setToast(""), 2200);
        return;
      }
      setGuests((data.guests || []) as GuestRow[]);
    } finally {
      setGuestBusy(false);
    }
  }

  async function invitePerson(row: SharePerson) {
    if (!me || shareBusy) return;
    setShareBusy(row.other.id);
    const body = encodeLiveInvite(
      sessionId,
      session.host
        ? {
            id: session.host.id,
            name: session.host.name,
            avatarHue: session.host.avatarHue,
            avatarUrl: session.host.avatarUrl,
          }
        : null,
      session.title,
      me
        ? {
            id: me.id,
            name: me.name,
            avatarHue: me.avatarHue,
            avatarUrl: me.avatarUrl,
          }
        : null,
    );
    try {
      let threadId = row.thread?.id;
      if (!threadId) {
        const created = await fetch("/api/inbox", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: row.other.id, body }),
        });
        const d = await created.json().catch(() => ({}));
        if (!created.ok || !d.thread?.id) {
          setToast("Couldn't send");
          window.setTimeout(() => setToast(""), 1600);
          return;
        }
        threadId = d.thread.id as string;
      } else {
        const sent = await fetch(`/api/inbox/${threadId}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        if (!sent.ok) {
          setToast("Couldn't send");
          window.setTimeout(() => setToast(""), 1600);
          return;
        }
      }
      setSentTo((prev) => new Set(prev).add(row.other.id));
      setToast(`Sent to ${row.other.name}`);
      window.setTimeout(() => setToast(""), 1600);
    } finally {
      setShareBusy(null);
    }
  }

  const host = session.host;
  const titleText = session.title?.trim() || "";
  const showTitleAgain = comments.length >= 10;
  const myGuest = me ? guests.find((g) => g.userId === me.id) : undefined;
  const pendingGuests = guests.filter((g) => g.status === "requested");
  const acceptedGuests = guests.filter((g) => g.status === "accepted");

  useEffect(() => {
    if (role !== "viewer" || myGuest?.status !== "accepted") return;
    setToast("You're a guest on this live");
    const t = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(t);
  }, [role, myGuest?.status]);

  return (
    <div
      className="absolute inset-0 z-20 text-white"
      onPointerDownCapture={(e) => {
        const t = e.target as HTMLElement | null;
        if (t?.closest("button, a, input, textarea, [data-no-like]")) return;
        onInteract?.();
      }}
    >
      {guestTiles}
      <div
        className="absolute inset-0 z-[1]"
        onPointerUp={onTapLayer}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget) return;
          e.preventDefault();
          likeOnce(e.clientX, e.clientY);
        }}
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-black/45 via-transparent to-black/55" />

      <div className="pointer-events-auto absolute top-[max(0.55rem,env(safe-area-inset-top))] inset-x-0 z-[15] flex items-center gap-2 px-3">
        <button
          type="button"
          onClick={(e) => {
            stopLike(e);
            void openHostSheet();
          }}
          className="flex max-w-[52%] items-center gap-2 rounded-full bg-black/45 py-1 pr-2.5 pl-1 text-left backdrop-blur-md"
        >
          {host ? (
            <Avatar name={host.name} hue={host.avatarHue} src={host.avatarUrl} size={32} showLive={false} />
          ) : (
            <div className="h-8 w-8 rounded-full bg-white/20" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-none">{host?.name || "Host"}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] leading-none text-white/80">
              <Heart className="h-3 w-3 fill-red-500 text-red-500" />
              <span className="tabular-nums font-semibold">{hearts > 999 ? `${(hearts / 1000).toFixed(1)}k` : hearts}</span>
            </p>
          </div>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {(hostControls || role === "host") && (
            <div className="mr-0.5 flex items-center gap-1" data-no-like>
              {hostControls}
              {role === "host" && onEnd ? (
                <button
                  type="button"
                  onClick={(e) => {
                    stopLike(e);
                    onEnd();
                  }}
                  className="grid h-9 w-9 place-items-center rounded-full bg-red-600 text-white shadow-[0_4px_14px_rgba(220,38,38,0.4)]"
                  aria-label="End live"
                  title="End live"
                >
                  <Power className="h-4 w-4" strokeWidth={2.5} />
                </button>
              ) : null}
            </div>
          )}
          <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[12px] font-semibold backdrop-blur-md">
            <Users className="h-3.5 w-3.5" />
            {session.viewerCount}
          </span>
          {role === "viewer" ? (
            <button
              type="button"
              onClick={(e) => {
                stopLike(e);
                onClose();
              }}
              className="grid h-8 w-8 place-items-center rounded-full bg-black/40 backdrop-blur-md"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-[4] overflow-hidden">
        {floats.map((f) => (
          <span
            key={f.id}
            className="absolute animate-live-heart text-red-500"
            style={{ left: `${f.x}%`, top: `${f.y}%`, animationDelay: `${f.delay}ms` }}
          >
            <Heart className="fill-red-500 text-red-500 drop-shadow-md" style={{ width: f.size, height: f.size }} />
          </span>
        ))}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 z-[5] px-3"
        style={{ bottom: `calc(${kbOffset}px + max(4.35rem, env(safe-area-inset-bottom) + 3.5rem))` }}
      >
        <div
          ref={listRef}
          className="pointer-events-auto max-h-[22vh] w-[min(100%,17.5rem)] space-y-1 overflow-y-auto pr-1"
        >
          {titleText ? (
            <div className="w-fit max-w-[95%] rounded-2xl bg-black/35 px-2.5 py-1 text-[12px] font-medium leading-snug backdrop-blur-sm">
              {titleText}
            </div>
          ) : null}
          {comments.map((c) => {
            const joined = c.body === LIVE_JOIN_MARKER;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  if (c.author) void openUserSheet(c.author);
                }}
                className="flex max-w-[95%] items-center gap-2 rounded-2xl bg-black/30 px-2 py-1 text-left backdrop-blur-sm"
              >
                {c.author ? (
                  <Avatar name={c.author.name} hue={c.author.avatarHue} src={c.author.avatarUrl} size={20} showLive={false} />
                ) : null}
                <p className="min-w-0 text-[12px] leading-snug">
                  <span className="font-semibold text-white/95">{c.author?.name || "Viewer"} </span>
                  {joined ? (
                    <span className="text-white/65">joined</span>
                  ) : (
                    <span className="text-white/90">{c.body}</span>
                  )}
                </p>
              </button>
            );
          })}
          {showTitleAgain && titleText ? (
            <div className="w-fit max-w-[95%] rounded-2xl bg-black/35 px-2.5 py-1 text-[12px] font-medium leading-snug backdrop-blur-sm">
              {titleText}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="pointer-events-auto absolute inset-x-0 bottom-0 z-[6] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
        style={{ transform: kbOffset ? `translateY(-${kbOffset}px)` : undefined }}
      >
        {toast ? <p className="mb-1.5 text-center text-[11px] font-medium text-white/85">{toast}</p> : null}
        {role === "viewer" && myGuest?.status === "requested" ? (
          <p className="mb-1.5 text-center text-[12px] font-semibold text-[#ffb703]">Guest request pending…</p>
        ) : null}
        <form onSubmit={(e) => void sendComment(e)} className="relative flex items-center gap-2" data-no-like>
          {role === "host" ? (
            <button
              type="button"
              onClick={(e) => {
                stopLike(e);
                setGuestSheet(true);
              }}
              className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/35 backdrop-blur-md"
              aria-label="Guests"
              title="Guests"
            >
              <UserPlus className="h-5 w-5" />
              {pendingGuests.length ? (
                <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#e85d04] px-0.5 text-[9px] font-bold">
                  {pendingGuests.length}
                </span>
              ) : null}
            </button>
          ) : (
            <button
              type="button"
              disabled={guestBusy || myGuest?.status === "requested" || myGuest?.status === "accepted"}
              onClick={(e) => {
                stopLike(e);
                void requestGuest();
              }}
              className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full backdrop-blur-md disabled:opacity-70 ${
                myGuest?.status === "accepted"
                  ? "bg-[#e85d04]"
                  : myGuest?.status === "requested"
                    ? "bg-white/20"
                    : "bg-black/35"
              }`}
              aria-label={
                myGuest?.status === "accepted"
                  ? "Joined as guest"
                  : myGuest?.status === "requested"
                    ? "Guest request pending"
                    : "Request to join as guest"
              }
              title={
                myGuest?.status === "accepted"
                  ? "Guest"
                  : myGuest?.status === "requested"
                    ? "Pending"
                    : "Join"
              }
            >
              <UserPlus className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              stopLike(e);
              void openShare();
            }}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/35 backdrop-blur-md"
            aria-label="Share live"
          >
            <LiveShareIcon className="h-5 w-5" />
          </button>
          <div className="flex h-11 flex-1 items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-2.5 backdrop-blur-md">
            <EmojiComposerButton
              dark
              open={emojiOpen}
              setOpen={setEmojiOpen}
              onPick={(emoji) => setDraft((d) => (d.length + emoji.length <= 200 ? d + emoji : d))}
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => setEmojiOpen(false)}
              placeholder="Say something…"
              maxLength={200}
              enterKeyHint="send"
              autoComplete="off"
              className="h-full w-full bg-transparent text-[16px] outline-none placeholder:text-white/45"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e85d04] text-white disabled:opacity-40"
            aria-label="Send comment"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>

      {hostSheet && profileSheet ? (
        <div
          data-sheet
          className="pointer-events-auto absolute inset-0 z-30 flex items-end bg-black/55"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHostSheet(false);
          }}
        >
          <div className="w-full overflow-hidden rounded-t-[1.4rem] bg-[#111]">
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="h-1 w-10 rounded-full bg-white/25" />
            </div>
            <div className="flex flex-col items-center px-5 pt-2 pb-5">
              <Avatar
                name={profileSheet.name}
                hue={profileSheet.avatarHue}
                src={profileSheet.avatarUrl}
                size={72}
                showLive={false}
              />
              <p className="mt-3 text-[18px] font-semibold">{profileSheet.name}</p>
              {profileSheet.headline ? (
                <p className="mt-1 max-w-sm text-center text-[13px] text-white/50">{profileSheet.headline}</p>
              ) : null}
              <div className="mt-4 flex items-center gap-8">
                <div className="text-center">
                  <p className="text-[18px] font-semibold tabular-nums">{profileMeta?.followers ?? "—"}</p>
                  <p className="text-[12px] text-white/45">Followers</p>
                </div>
                <div className="text-center">
                  <p className="text-[18px] font-semibold tabular-nums">{profileMeta?.following ?? "—"}</p>
                  <p className="text-[12px] text-white/45">Following</p>
                </div>
              </div>
              <div className="mt-5 flex w-full gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                {me && profileSheet.id !== me.id ? (
                  <button
                    type="button"
                    onClick={() => void toggleFollowProfile()}
                    className={`h-11 flex-1 rounded-full text-[15px] font-semibold ${
                      profileMeta?.youFollow ? "bg-white/12 text-white" : "bg-[#e85d04] text-white"
                    }`}
                  >
                    {profileMeta?.youFollow ? "Following" : "Follow"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={goToHostProfile}
                  className="h-11 flex-1 rounded-full bg-white text-[15px] font-semibold text-black"
                >
                  View profile
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {guestSheet && role === "host" ? (
        <div
          data-sheet
          className="pointer-events-auto absolute inset-0 z-30 flex items-end bg-black/55"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGuestSheet(false);
          }}
        >
          <div className="w-full overflow-hidden rounded-t-[1.35rem] bg-[#111] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="h-1 w-10 rounded-full bg-white/25" />
            </div>
            <div className="flex items-center justify-between px-4 py-2">
              <div>
                <p className="text-[17px] font-semibold">Guest requests</p>
                <p className="text-[12px] text-white/45">
                  On stage {acceptedGuests.length}/{LIVE_MAX_GUESTS}
                  {acceptedGuests.length >= LIVE_MAX_GUESTS ? " · packed" : ""}
                </p>
              </div>
              <button type="button" onClick={() => setGuestSheet(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[50vh] space-y-1 overflow-y-auto px-2 pb-2">
              {pendingGuests.length === 0 && acceptedGuests.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-white/45">No guest requests yet</p>
              ) : null}
              {acceptedGuests.length >= LIVE_MAX_GUESTS && pendingGuests.length > 0 ? (
                <p className="mx-2 mb-2 rounded-xl bg-white/8 px-3 py-2 text-[12px] leading-snug text-white/70">
                  Stage is packed. Drop someone on live to accept a waiting guest.
                </p>
              ) : null}
              {pendingGuests.map((g) => (
                <div key={g.userId} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                  {g.user ? <Avatar name={g.user.name} hue={g.user.avatarHue} src={g.user.avatarUrl} size={44} userId={g.userId} /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{g.user?.name || "Viewer"}</p>
                    <p className="text-[12px] text-white/45">
                      {acceptedGuests.length >= LIVE_MAX_GUESTS ? "Waiting for a free spot" : "Wants to join your live"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={guestBusy}
                    onClick={() => void resolveGuest(g.userId, "rejected")}
                    className="grid h-9 w-9 place-items-center rounded-full bg-white/10"
                    aria-label="Decline"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={guestBusy || acceptedGuests.length >= LIVE_MAX_GUESTS}
                    onClick={() => void resolveGuest(g.userId, "accepted")}
                    className="grid h-9 w-9 place-items-center rounded-full bg-[#e85d04] disabled:opacity-35"
                    aria-label="Accept"
                    title={acceptedGuests.length >= LIVE_MAX_GUESTS ? "Stage is packed" : "Accept"}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {acceptedGuests.map((g) => (
                <div key={`ok_${g.userId}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                  {g.user ? <Avatar name={g.user.name} hue={g.user.avatarHue} src={g.user.avatarUrl} size={44} userId={g.userId} /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{g.user?.name || "Viewer"}</p>
                    <p className="text-[12px] text-[#e85d04]">On as guest</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {shareOpen ? (
        <div
          data-sheet
          className="pointer-events-auto absolute inset-0 z-30 flex items-end bg-black/55"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShareOpen(false);
          }}
        >
          <div className="w-full overflow-hidden rounded-t-[1.35rem] bg-[#111] shadow-[0_-12px_40px_rgba(0,0,0,0.45)]">
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="h-1 w-10 rounded-full bg-white/25" />
            </div>
            <div className="flex items-center justify-between px-5 pb-2 pt-1">
              <p className="text-[17px] font-semibold tracking-tight">Share live</p>
              <button type="button" onClick={() => setShareOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.08]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="px-5 pb-3 text-[13px] text-white/45">Suggests people you follow and others on Connect Pro</p>
            <div className="max-h-[46vh] overflow-y-auto px-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {!people.length ? (
                <p className="px-4 py-10 text-center text-sm text-white/45">No one to share with yet.</p>
              ) : (
                <ul>
                  {people.map((row) => {
                    const done = sentTo.has(row.other.id);
                    return (
                      <li key={row.other.id} className="flex items-center gap-3 px-3 py-2.5">
                        <Avatar name={row.other.name} hue={row.other.avatarHue} src={row.other.avatarUrl} size={44} />
                        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{row.other.name}</p>
                        <button
                          type="button"
                          disabled={done || shareBusy === row.other.id}
                          onClick={() => void invitePerson(row)}
                          className={`h-9 min-w-[4.5rem] rounded-full px-4 text-[13px] font-semibold disabled:opacity-70 ${
                            done ? "bg-white/15 text-white" : "bg-white text-black"
                          }`}
                        >
                          {done ? (
                            <span className="inline-flex items-center gap-1">
                              <Check className="h-3.5 w-3.5" /> Sent
                            </span>
                          ) : shareBusy === row.other.id ? (
                            "…"
                          ) : (
                            "Send"
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
