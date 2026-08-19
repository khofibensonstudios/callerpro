"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "./Avatar";
import { useAuth } from "./AuthProvider";
import { inboxHref, type InboxItem } from "@/lib/inbox-shared";

type Banner = {
  key: string;
  kind: InboxItem["kind"];
  title: string;
  body: string;
  href: string;
  other: InboxItem["other"];
};

function hrefFor(item: InboxItem) {
  return inboxHref(item);
}

function titleFor(item: InboxItem) {
  if (item.kind === "chat") {
    return `Message from ${item.other.name}`;
  }
  if (item.kind === "follow") return `${item.other.name} followed you`;
  if (item.kind === "comment") return `${item.other.name} commented`;
  if (item.kind === "mention") return `${item.other.name} tagged you`;
  if (item.kind === "comment_like") return `${item.other.name} liked your comment`;
  return `${item.other.name} liked your post`;
}

export function InAppNotify() {
  const { user } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [banner, setBanner] = useState<Banner | null>(null);
  const known = useRef<Map<string, string>>(new Map());
  const primed = useRef(false);
  const hideTimer = useRef<number | null>(null);
  const activeThread = path.startsWith("/messages") ? params.get("t") : null;

  useEffect(() => {
    if (!user) {
      known.current = new Map();
      primed.current = false;
      setBanner(null);
      return;
    }

    let stop = false;

    async function tick() {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/inbox", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (stop) return;
        const items = (data.items ?? []) as InboxItem[];
        const nextKnown = new Map<string, string>();
        let newest: InboxItem | null = null;

        for (const item of items) {
          if (!item.unread) continue;
          if (item.kind === "chat" && item.threadId && item.threadId === activeThread) continue;
          nextKnown.set(item.id, item.at);
          const prevAt = known.current.get(item.id);
          const isNew = !prevAt || +new Date(item.at) > +new Date(prevAt);
          if (!primed.current) continue;
          if (!isNew) continue;
          if (!newest || +new Date(item.at) > +new Date(newest.at)) newest = item;
        }

        // Keep timestamps for unread + recently seen chats so resends still notify
        for (const item of items) {
          if (item.kind === "chat" || item.unread) nextKnown.set(item.id, item.at);
        }
        // Preserve known keys that dropped off briefly
        for (const [id, at] of known.current) {
          if (!nextKnown.has(id)) nextKnown.set(id, at);
        }
        known.current = nextKnown;

        if (!primed.current) {
          primed.current = true;
          return;
        }

        if (newest) {
          const payload: Banner = {
            key: `${newest.id}:${newest.at}`,
            kind: newest.kind,
            title: titleFor(newest),
            body: newest.preview,
            href: hrefFor(newest),
            other: newest.other,
          };
          setBanner(payload);
          if (hideTimer.current) window.clearTimeout(hideTimer.current);
          hideTimer.current = window.setTimeout(() => setBanner(null), 5600);
        }
      } catch {
        /* ignore */
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), 10000);
    const onVis = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [user, activeThread]);

  if (!banner) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={() => {
          setBanner(null);
          router.push(banner.href);
        }}
        className="in-app-banner pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-white/95 px-3.5 py-3 text-left shadow-[0_12px_40px_rgba(0,0,0,0.22)] ring-1 ring-black/8 backdrop-blur-md"
      >
        <Avatar name={banner.other.name} hue={banner.other.avatarHue} src={banner.other.avatarUrl} size={44} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-[#141414]">{banner.title}</span>
          <span className="mt-0.5 block truncate text-sm text-[#6f6a64]">{banner.body}</span>
        </span>
      </button>
    </div>
  );
}
