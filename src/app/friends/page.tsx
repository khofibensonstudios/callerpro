"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteChrome } from "@/components/SiteChrome";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/components/AuthProvider";

type Person = {
  id: string;
  name: string;
  headline: string;
  avatarHue: number;
  avatarUrl?: string;
  coverUrl?: string;
};

export default function FriendsPage() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [following, setFollowing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/creators")
      .then((r) => r.json())
      .then((d) => setPeople((d.creators ?? []).filter((p: Person) => p.id !== user?.id)));
    fetch("/api/friends")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, boolean> = {};
        for (const id of d.following ?? []) map[id] = true;
        setFollowing(map);
      });
  }, [user]);

  async function toggle(id: string) {
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    const d = await res.json();
    if (res.ok) setFollowing((s) => ({ ...s, [id]: !!d.following }));
  }

  return (
    <SiteChrome>
      <h1 className="text-2xl font-bold tracking-tight">Following</h1>
      <p className="mt-1 text-sm text-fb-muted">Find people. Follow them. They show up in Chats.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {people.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="h-24 bg-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.coverUrl || "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80"}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="-mt-8 flex justify-center">
              <Link href={`/u/${p.id}`} className="rounded-full">
                <Avatar name={p.name} hue={p.avatarHue} src={p.avatarUrl} size={72} userId={p.id} />
              </Link>
            </div>
            <div className="px-3 pt-2 pb-3 text-center">
              <Link href={`/u/${p.id}`} className="font-semibold">
                {p.name}
              </Link>
              <p className="mt-1 line-clamp-2 min-h-10 text-xs text-fb-muted">{p.headline}</p>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className={`mt-3 w-full rounded-full py-2 text-sm font-semibold ${
                  following[p.id] ? "bg-[#f4f1eb] text-[#141414]" : "bg-[#141414] text-white"
                }`}
              >
                {following[p.id] ? "Following" : "Follow"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </SiteChrome>
  );
}
