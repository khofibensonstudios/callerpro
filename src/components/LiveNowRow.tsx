"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { useAuth } from "./AuthProvider";
import type { LiveSession } from "@/lib/live";

export function LiveNowRow() {
  const { user } = useAuth();
  const [lives, setLives] = useState<LiveSession[]>([]);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch("/api/live", { credentials: "include", cache: "no-store" });
        const data = await res.json();
        if (!stop) setLives(data.lives ?? []);
      } catch {
        /* ignore */
      }
    }
    void load();
    const t = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 4000);
    const onVis = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", load);
    return () => {
      stop = true;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", load);
    };
  }, []);

  if (!lives.length) return null;

  return (
    <div className="hide-scroll flex gap-4 overflow-x-auto border-b border-black/[0.06] px-3 py-3">
      {lives.map((live) => {
        const host = live.host;
        const name = host?.name || "Live";
        const hue = host?.avatarHue ?? 210;
        const isMe = Boolean(user && (live.hostId === user.id || host?.id === user.id));
        const href = isMe ? "/live/go" : `/live/${live.id}`;
        return (
          <Link key={live.id} href={href} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
            <span className="relative rounded-full bg-[conic-gradient(#ff3b30,#e85d04,#ff3b30)] p-[2.5px]">
              <span className="block rounded-full bg-white p-[2px]">
                <Avatar name={name} hue={hue} src={host?.avatarUrl} size={58} userId={host?.id} />
              </span>
              <span className="absolute inset-x-0 -bottom-1 mx-auto w-fit rounded bg-[#ff3b30] px-1 text-[9px] font-bold tracking-wide text-white">
                LIVE
              </span>
            </span>
            <span className="w-full truncate pt-1 text-center text-[11px]">{isMe ? "You" : name.split(" ")[0]}</span>
          </Link>
        );
      })}
    </div>
  );
}
