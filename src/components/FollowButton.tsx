"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserPlus, Users } from "lucide-react";
import { useAuth } from "./AuthProvider";

type Graph = { following: Set<string>; followers: Set<string> };

let cached: Graph | null = null;
let inflight: Promise<Graph> | null = null;

function loadGraph() {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = fetch("/api/friends", { credentials: "include" })
    .then((r) => r.json())
    .then((d) => {
      const next = {
        following: new Set<string>(d.following ?? []),
        followers: new Set<string>(d.followers ?? []),
      };
      cached = next;
      inflight = null;
      return next;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

export function useFollowGraph() {
  const { user } = useAuth();
  const [graph, setGraph] = useState<Graph>(cached ?? { following: new Set(), followers: new Set() });

  useEffect(() => {
    if (!user) {
      cached = null;
      inflight = null;
      setGraph({ following: new Set(), followers: new Set() });
      return;
    }
    loadGraph()
      .then(setGraph)
      .catch(() => {});
  }, [user]);

  function setFollowing(userId: string, on: boolean) {
    setGraph((prev) => {
      const following = new Set(prev.following);
      if (on) following.add(userId);
      else following.delete(userId);
      const next = { ...prev, following };
      cached = next;
      return next;
    });
  }

  return { ...graph, setFollowing };
}

export function followLabel(iFollow: boolean, theyFollow: boolean) {
  if (iFollow && theyFollow) return "Friends";
  if (iFollow) return "Following";
  return "Follow";
}

export function FollowChip({
  userId,
  tone = "light",
}: {
  userId: string;
  tone?: "light" | "dark";
}) {
  const { user } = useAuth();
  const { following, followers, setFollowing } = useFollowGraph();
  const [live, setLive] = useState(false);
  useEffect(() => {
    setLive(true);
  }, []);
  if (!live || !user || user.id === userId) return null;
  const iFollow = following.has(userId);
  const theyFollow = followers.has(userId);
  const label = followLabel(iFollow, theyFollow);
  const Icon = label === "Friends" ? Users : label === "Following" ? UserCheck : UserPlus;

  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const res = await fetch("/api/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const d = await res.json();
        if (res.ok) setFollowing(userId, !!d.following);
      }}
      className={
        tone === "dark"
          ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-[#7dd3fc]"
          : "inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e8f4ef] px-2 py-0.5 text-[11px] font-semibold text-[#0f766e]"
      }
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {label}
    </button>
  );
}

export function FollowButton({
  userId,
  iFollow,
  theyFollow,
}: {
  userId: string;
  iFollow: boolean;
  theyFollow: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [on, setOn] = useState(iFollow);
  if (!user || user.id === userId) return null;

  const label = followLabel(on, theyFollow);

  return (
    <button
      type="button"
      onClick={async () => {
        const res = await fetch("/api/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const d = await res.json();
        if (res.ok) {
          setOn(!!d.following);
          router.refresh();
        }
      }}
      className={`h-8 min-w-[90px] rounded-lg px-4 text-[13px] font-semibold ${
        on ? "bg-[#efefef] text-[#141414]" : "bg-[#141414] text-white"
      }`}
    >
      {label}
    </button>
  );
}
