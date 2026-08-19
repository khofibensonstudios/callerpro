"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { useAuth } from "./AuthProvider";
import { mentionQuery } from "@/lib/mentions";
import type { PublicUser } from "@/lib/types";

export type CommentRow = {
  id: string;
  body: string;
  createdAt: string;
  likedBy?: string[];
  author: PublicUser | null;
};

function CommentBody({ body }: { body: string }) {
  const parts = body.split(/(@[A-Za-z0-9._-]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="font-semibold text-[#e85d04]">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function CommentsSheet({
  postId,
  open,
  onClose,
  onCount,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
  onCount?: (n: number) => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [people, setPeople] = useState<PublicUser[]>([]);

  const onCountRef = useRef(onCount);
  onCountRef.current = onCount;

  useEffect(() => {
    if (!open) return;
    setError("");
    fetch(`/api/posts/${postId}/comments`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const list = d.comments ?? [];
        setComments(list);
        onCountRef.current?.(list.length);
      })
      .catch(() => {});
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open, postId]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/creators")
      .then((r) => r.json())
      .then((d) => setPeople(d.creators ?? []))
      .catch(() => {});
  }, [open]);

  const query = mentionQuery(text);
  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return people
      .filter((p) => p.id !== user?.id && p.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [people, query, user?.id]);

  function pickPerson(person: PublicUser) {
    const at = text.lastIndexOf("@");
    const tag = `@${person.name.replace(/\s+/g, "")} `;
    setText(`${text.slice(0, at)}${tag}`);
    inputRef.current?.focus();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      router.push("/login");
      return;
    }
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "Could not post that comment.");
        return;
      }
      if (d.comment) {
        setComments((c) => {
          const next = [...c, d.comment];
          onCount?.(next.length);
          return next;
        });
        setText("");
      }
    } finally {
      setSending(false);
    }
  }

  async function likeComment(id: string) {
    if (!user) {
      router.push("/login");
      return;
    }
    const res = await fetch(`/api/posts/${postId}/comments/${id}/like`, {
      method: "POST",
      credentials: "include",
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.comment) {
      setComments((list) => list.map((c) => (c.id === id ? { ...c, likedBy: d.comment.likedBy ?? [] } : c)));
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end bg-black/45" onClick={onClose}>
      <div
        className="flex max-h-[78%] flex-col rounded-t-2xl bg-[#f4f1eb] text-[#141414]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-[15px] font-semibold">{comments.length} {comments.length === 1 ? "comment" : "comments"}</p>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center" aria-label="Close comments">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
          {!comments.length ? (
            <p className="py-8 text-center text-sm text-fb-muted">No comments yet. Be the first.</p>
          ) : (
            comments.map((c) => {
              const liked = !!(user && (c.likedBy ?? []).includes(user.id));
              return (
                <div key={c.id} className="mb-3 flex gap-2">
                  <Avatar name={c.author?.name || "?"} hue={c.author?.avatarHue ?? 0} src={c.author?.avatarUrl} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] leading-5">
                      <span className="font-semibold">{c.author?.name}</span>{" "}
                      <CommentBody body={c.body} />
                    </p>
                    <p className="mt-0.5 text-[12px] text-fb-muted">{(c.likedBy ?? []).length ? `${(c.likedBy ?? []).length} likes` : ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void likeComment(c.id)}
                    className="mt-1 shrink-0"
                    aria-label="Like comment"
                  >
                    <Heart className={`h-4 w-4 ${liked ? "fill-[#e85d04] text-[#e85d04]" : "text-[#6f6a64]"}`} />
                  </button>
                </div>
              );
            })
          )}
        </div>
        {suggestions.length ? (
          <div className="border-t border-black/10 bg-white px-2 py-2">
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPerson(p)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#f4f1eb]"
              >
                <Avatar name={p.name} hue={p.avatarHue} src={p.avatarUrl} size={28} userId={p.id} />
                <span className="text-sm font-semibold">{p.name}</span>
              </button>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(e) => void send(e)}
          className="flex items-center gap-2 border-t border-black/10 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <Avatar name={user?.name || "?"} hue={user?.avatarHue ?? 210} src={user?.avatarUrl} size={32} />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={user ? "Add a comment…  @ to tag" : "Log in to comment"}
            className="h-10 flex-1 rounded-full bg-[#f4f1eb] px-3 text-sm outline-none placeholder:text-black/35"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="h-10 rounded-full bg-[#141414] px-4 text-sm font-semibold text-white disabled:opacity-30"
          >
            Post
          </button>
        </form>
        {error ? <p className="bg-white px-4 pb-3 text-sm text-[#e85d04]">{error}</p> : null}
      </div>
    </div>
  );
}
