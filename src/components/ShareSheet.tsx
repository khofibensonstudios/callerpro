"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { useAuth } from "./AuthProvider";
import { copyUrl } from "@/lib/share";
import type { PublicUser } from "@/lib/types";

export function ShareSheet({
  open,
  onClose,
  url,
  title,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  title: string;
}) {
  const { user } = useAuth();
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [copied, setCopied] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    setSentId(null);
    setNotice("");
    fetch("/api/creators")
      .then((r) => r.json())
      .then((d) => setPeople((d.creators ?? []).filter((p: PublicUser) => p.id !== user?.id)))
      .catch(() => {});
  }, [open, user?.id]);

  async function shareNative() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url, text: title });
        onClose();
        return;
      }
    } catch {
      /* cancelled */
      return;
    }
    await copy();
  }

  async function copy() {
    await copyUrl(url);
    setCopied(true);
    setNotice("Link copied");
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function sendTo(person: PublicUser) {
    if (!user) return;
    setBusy(person.id);
    setNotice("");
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: person.id, body: url }),
      });
      if (res.ok) {
        setSentId(person.id);
        setNotice(`Sent to ${person.name}`);
      } else {
        setNotice("Could not send. Try again.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/45" onClick={onClose}>
      <div
        className="max-h-[78%] overflow-y-auto rounded-t-2xl bg-[#f4f1eb] text-[#141414]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-[15px] font-semibold">Share</p>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center" aria-label="Close share">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={() => void shareNative()}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold"
          >
            <Share2 className="h-4 w-4" />
            Share via…
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        {notice ? <p className="px-4 pb-2 text-sm text-fb-muted">{notice}</p> : null}
        <p className="px-4 pb-2 text-[11px] font-semibold tracking-wide text-fb-muted uppercase">Send to</p>
        <div className="px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!user ? (
            <p className="px-2 pb-4 text-sm text-fb-muted">Log in to send this to someone on Connect Pro.</p>
          ) : !people.length ? (
            <p className="px-2 pb-4 text-sm text-fb-muted">No people to send to yet.</p>
          ) : (
            people.slice(0, 24).map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy === p.id}
                onClick={() => void sendTo(p)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white"
              >
                <Avatar name={p.name} hue={p.avatarHue} src={p.avatarUrl} size={40} userId={p.id} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                <span className="text-sm font-semibold text-[#e85d04]">
                  {sentId === p.id ? "Sent" : busy === p.id ? "…" : "Send"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
