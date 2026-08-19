"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import type { LiveInviteHost } from "@/lib/live-shared";

type LiveCardState = {
  status: "checking" | "live" | "ended";
  joinId: string;
  title: string;
  host: LiveInviteHost | null;
  viewerCount: number;
};

type LiveRow = {
  id: string;
  status?: string;
  title?: string;
  viewerCount?: number;
  hostId?: string;
  host?: LiveInviteHost;
};

function asHost(h?: LiveInviteHost | null, fallbackId?: string): LiveInviteHost | null {
  if (h?.id && h.name) {
    return {
      id: h.id,
      name: h.name,
      avatarHue: h.avatarHue ?? 28,
      avatarUrl: h.avatarUrl || `/api/users/${h.id}/photo`,
    };
  }
  if (fallbackId) {
    return {
      id: fallbackId,
      name: "Loading…",
      avatarHue: 28,
      avatarUrl: `/api/users/${fallbackId}/photo`,
    };
  }
  return null;
}

async function findHostLive(hostId: string): Promise<LiveRow | null> {
  const res = await fetch("/api/live", { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  const lives = (data.lives || []) as LiveRow[];
  return (
    lives.find((l) => {
      const hid = l.hostId || l.host?.id;
      const st = String(l.status || "live").toLowerCase().trim();
      return hid === hostId && st === "live";
    }) || null
  );
}

function isLiveStatus(status: unknown) {
  return String(status || "").toLowerCase().trim() === "live";
}

export function LiveInviteCard({
  sessionId,
  initialHost,
  initialTitle,
  sharedBy,
}: {
  sessionId: string;
  mine?: boolean;
  initialHost?: LiveInviteHost | null;
  initialTitle?: string;
  sharedBy?: LiveInviteHost | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<LiveCardState>({
    status: "checking",
    joinId: sessionId,
    title: initialTitle || "Live",
    host: asHost(initialHost),
    viewerCount: 0,
  });

  useEffect(() => {
    let stop = false;

    async function load() {
      let host = asHost(initialHost);
      let joinId = sessionId;
      let title = initialTitle || "Live";
      let viewerCount = 0;
      let live = false;

      async function applyCurrent(current: LiveRow) {
        live = true;
        joinId = current.id;
        title = (current.title || title).trim() || "Live";
        viewerCount = Number(current.viewerCount) || 0;
        host = asHost(current.host || host, current.hostId);
      }

      try {
        const res = await fetch(`/api/live/${encodeURIComponent(sessionId)}`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (stop) return;

        if (res.ok && data.session) {
          const s = data.session as LiveRow;
          host = asHost(s.host || host, s.hostId);
          title = (s.title || title).trim() || "Live";
          viewerCount = Number(s.viewerCount) || 0;
          if (isLiveStatus(s.status)) {
            live = true;
            joinId = s.id || sessionId;
          }
        }

        // Always cross-check live list by host / sharer — invite ids can be stale
        if (!live) {
          const candidates = [host?.id, initialHost?.id, sharedBy?.id].filter(Boolean) as string[];
          for (const uid of candidates) {
            const current = await findHostLive(uid);
            if (stop) return;
            if (current) {
              await applyCurrent(current);
              break;
            }
          }
        }

        if (host?.id && (!host.name || host.name === "Loading…")) {
          const uRes = await fetch(`/api/users/${host.id}`, { credentials: "include" });
          const uData = await uRes.json().catch(() => ({}));
          if (!stop && uData.user) {
            host = {
              id: uData.user.id,
              name: uData.user.name,
              avatarHue: uData.user.avatarHue ?? 28,
              avatarUrl: uData.user.avatarUrl || `/api/users/${uData.user.id}/photo`,
            };
          }
        }
      } catch {
        /* keep previous */
      }

      if (stop) return;
      setState({
        status: live ? "live" : "ended",
        joinId,
        title,
        host,
        viewerCount,
      });
    }

    void load();
    const t = window.setInterval(() => void load(), 3000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [sessionId, initialTitle, initialHost?.id, initialHost?.name, initialHost?.avatarHue, sharedBy?.id]);

  const live = state.status === "live";
  const checking = state.status === "checking";
  const host = state.host;
  const hostName = host?.name?.trim() && host.name !== "Loading…" ? host.name : null;
  const sharer = sharedBy?.name?.trim() || null;
  const samePerson = host && sharedBy && host.id === sharedBy.id;

  function join() {
    if (!live) return;
    router.push(`/live/${state.joinId}`);
  }

  return (
    <button
      type="button"
      disabled={!live}
      onClick={join}
      className={`w-[280px] overflow-hidden rounded-2xl bg-white text-left ring-1 ring-black/10 ${
        live ? "cursor-pointer active:scale-[0.99]" : "cursor-default"
      }`}
    >
      <div className="relative h-28 overflow-hidden bg-[#141414]">
        {host?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={host.avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
        ) : (
          <div
            className="absolute inset-0 opacity-80"
            style={{ background: `hsl(${host?.avatarHue ?? 28} 55% 28%)` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          {checking ? (
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">…</span>
          ) : live ? (
            <span className="rounded bg-[#ff3b30] px-1.5 py-0.5 text-[10px] font-black tracking-wide text-white uppercase">
              Live
            </span>
          ) : (
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">Ended</span>
          )}
          {live ? <span className="text-[11px] font-medium text-white/85">{state.viewerCount} watching</span> : null}
        </div>
        <div className="absolute right-3 bottom-3 left-3 flex items-end gap-2.5">
          {host ? (
            <Avatar name={host.name} hue={host.avatarHue} src={host.avatarUrl} size={44} userId={host.id} />
          ) : (
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/20 text-sm font-bold text-white">?</span>
          )}
          <div className="min-w-0 flex-1 pb-0.5">
            <p className="truncate text-[15px] font-bold text-white">{hostName || (checking ? "Checking…" : "Live")}</p>
            <p className="truncate text-[12px] text-white/75">
              {checking ? "Checking live…" : live ? state.title || "Live now" : "Live ended"}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-2 px-3.5 py-3">
        {sharer && !samePerson ? (
          <p className="text-[12px] text-fb-muted">
            <span className="font-semibold text-[#141414]">{sharer}</span> shared this live with you
          </p>
        ) : sharer ? (
          <p className="text-[12px] text-fb-muted">
            <span className="font-semibold text-[#141414]">{sharer}</span> invited you to their live
          </p>
        ) : (
          <p className="text-[12px] text-fb-muted">
            {checking ? "Checking…" : live ? "Tap to join this live" : "This live has ended"}
          </p>
        )}
        <span
          className={`inline-flex h-9 w-full items-center justify-center rounded-full text-[13px] font-bold ${
            live ? "bg-[#e85d04] text-white" : "bg-[#f4f1eb] text-fb-muted"
          }`}
        >
          {checking ? "Checking…" : live ? "Join live" : "Live ended"}
        </span>
      </div>
    </button>
  );
}
