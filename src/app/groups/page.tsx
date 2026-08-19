"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { SiteChrome } from "@/components/SiteChrome";
import { Avatar } from "@/components/Avatar";
import type { InboxItem } from "@/lib/inbox-shared";

type Person = { id: string; name: string; avatarHue: number; avatarUrl?: string };
type Group = {
  id: string;
  title: string;
  members: Person[];
  preview: string;
  updatedAt: string;
};

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/groups", { credentials: "include" });
    const d = await res.json().catch(() => ({}));
    setGroups(d.groups ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!creating) return;
    fetch("/api/inbox", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const items = (d.items ?? []) as InboxItem[];
        const next: Person[] = [];
        const seen = new Set<string>();
        for (const item of items) {
          if (item.isGroup || !item.other?.id || seen.has(item.other.id)) continue;
          seen.add(item.other.id);
          next.push(item.other);
        }
        setPeople(next);
      })
      .catch(() => {});
  }, [creating]);

  async function create() {
    if (!picked.length || busy) return;
    setBusy(true);
    const res = await fetch("/api/groups", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, userIds: picked }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return;
    setCreating(false);
    setTitle("");
    setPicked([]);
    if (d.thread?.id) router.push(`/messages?t=${encodeURIComponent(d.thread.id)}`);
    else void load();
  }

  return (
    <SiteChrome variant="chat">
      <div className="flex h-full min-h-0 flex-1 flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
            <p className="mt-0.5 text-sm text-fb-muted">Chat and call together</p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="grid h-10 w-10 place-items-center rounded-full bg-[#141414] text-white"
            aria-label="New group"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {groups === null ? (
            <p className="px-4 py-8 text-sm text-fb-muted">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="px-4 py-8 text-sm text-fb-muted">No groups yet. Tap + to start one.</p>
          ) : (
            groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => router.push(`/messages?t=${encodeURIComponent(g.id)}`)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#faf8f4]"
              >
                <Avatar name={g.title} hue={g.members[0]?.avatarHue || 28} src={g.members[0]?.avatarUrl} size={52} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{g.title}</span>
                  <span className="mt-0.5 block truncate text-sm text-fb-muted">
                    {g.members.length} members · {g.preview.startsWith("<<") ? "Media" : g.preview}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {creating ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="font-semibold">New group</p>
            <button type="button" onClick={() => setCreating(false)} className="grid h-10 w-10 place-items-center" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Group name"
              className="h-12 w-full rounded-xl bg-[#f4f1eb] px-4 outline-none"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            {people.length === 0 ? (
              <p className="px-3 py-6 text-sm text-fb-muted">Chat with people first, then add them here.</p>
            ) : (
              people.map((p) => {
                const on = picked.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPicked((cur) => (on ? cur.filter((id) => id !== p.id) : [...cur, p.id]))}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${on ? "bg-[#f4f1eb]" : ""}`}
                  >
                    <Avatar name={p.name} hue={p.avatarHue} src={p.avatarUrl} size={40} />
                    <span className="flex-1 font-semibold">{p.name}</span>
                    <span className={`grid h-5 w-5 place-items-center rounded-full border ${on ? "border-[#141414] bg-[#141414]" : "border-black/30"}`}>
                      {on ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={!picked.length || busy}
              onClick={() => void create()}
              className="h-12 w-full rounded-full bg-[#141414] text-sm font-semibold text-white disabled:opacity-40"
            >
              Create group
            </button>
          </div>
        </div>
      ) : null}
    </SiteChrome>
  );
}
