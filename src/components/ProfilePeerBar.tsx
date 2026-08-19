"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Phone, UsersRound } from "lucide-react";
import { useCallSession } from "./CallSession";
import { Avatar } from "./Avatar";

type Group = { id: string; title: string };
type Person = { id: string; name: string; avatarHue: number; avatarUrl?: string; callerId?: string };

export function ProfilePeerBar({
  profileId,
  person,
  groups,
}: {
  profileId: string;
  person: Person;
  groups: Group[];
}) {
  const router = useRouter();
  const { call, startCall } = useCallSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function threadId() {
    const res = await fetch("/api/inbox", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profileId }),
    });
    const d = await res.json().catch(() => ({}));
    return typeof d.thread?.id === "string" ? (d.thread.id as string) : "";
  }

  async function chat() {
    if (busy) return;
    setBusy(true);
    const id = await threadId();
    setBusy(false);
    if (id) router.push(`/messages?t=${encodeURIComponent(id)}`);
    else router.push("/messages");
  }

  async function callThem() {
    if (busy || call) return;
    setBusy(true);
    const id = await threadId();
    setBusy(false);
    if (!id) return;
    startCall({
      threadId: id,
      role: "caller",
      incoming: false,
      mode: "audio",
      other: { id: person.id, name: person.name, avatarHue: person.avatarHue, avatarUrl: person.avatarUrl },
    });
  }

  const cell = "flex min-w-0 flex-1 flex-col items-center gap-1 py-1";
  const icon = "grid h-10 w-10 place-items-center rounded-full bg-[#efefef] text-[#141414]";

  return (
    <>
      <div className="flex items-start justify-around">
        <button type="button" className={cell} onClick={() => setOpen(true)}>
          <span className={icon}>
            <UsersRound className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-semibold">Groups</span>
          <span className="text-[11px] text-fb-muted">{groups.length}</span>
        </button>
        <button type="button" className={cell} onClick={() => void callThem()} disabled={busy || !!call}>
          <span className={icon}>
            <Phone className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-semibold">Call</span>
        </button>
        <button type="button" className={cell} onClick={() => void chat()} disabled={busy}>
          <span className={icon}>
            <MessageCircle className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-semibold">Chats</span>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[400] flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="w-full rounded-t-2xl bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-4 py-3 text-sm font-bold">Groups together</p>
            {groups.length ? (
              groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#faf8f4]"
                  onClick={() => router.push(`/messages?t=${encodeURIComponent(g.id)}`)}
                >
                  <Avatar name={g.title} hue={28} size={40} />
                  <span className="font-semibold">{g.title}</span>
                </button>
              ))
            ) : (
              <p className="px-4 pb-6 text-sm text-fb-muted">No groups together yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
