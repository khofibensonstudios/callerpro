"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Avatar } from "./Avatar";
import { useAuth } from "./AuthProvider";
import { inboxHref, type InboxItem } from "@/lib/inbox-shared";

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MessengerMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    fetch("/api/inbox", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, [open, user]);

  if (!open) return null;

  return (
    <div className="absolute top-12 right-0 z-50 w-[360px] overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xl font-bold">Inbox</p>
        <button type="button" onClick={onClose} className="text-sm text-fb-muted">
          Close
        </button>
      </div>
      <div className="relative mx-3 mb-2">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-fb-muted" />
        <input className="h-9 w-full rounded-full bg-fb-bg pr-3 pl-9 text-sm" placeholder="Search inbox" />
      </div>
      <div className="hide-scroll max-h-80 overflow-y-auto pb-2">
        {items.slice(0, 12).map((item) => {
          const href = inboxHref(item);
          return (
            <Link
              key={item.id}
              href={href}
              onClick={onClose}
              className="flex w-full items-center gap-3 px-4 py-2 hover:bg-[#f4f1eb]"
            >
              <Avatar name={item.other.name} hue={item.other.avatarHue} src={item.other.avatarUrl} size={48} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className={`block truncate text-sm ${item.unread ? "font-bold" : "font-semibold"}`}>
                    {item.other.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-fb-muted">{timeAgo(item.at)}</span>
                </span>
                <span className={`block truncate text-xs ${item.unread ? "font-semibold text-[#141414]" : "text-fb-muted"}`}>
                  {item.preview}
                </span>
              </span>
              {item.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#e85d04]" /> : null}
            </Link>
          );
        })}
        {items.length === 0 ? <p className="px-4 py-6 text-center text-sm text-fb-muted">No activity yet</p> : null}
        <Link href="/messages" onClick={onClose} className="mx-3 my-2 block rounded-lg bg-[#f4f1eb] py-2 text-center text-sm font-semibold">
          See all
        </Link>
      </div>
    </div>
  );
}
