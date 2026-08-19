"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { copyUrl, shareUrl } from "@/lib/share";
import { postPath, watchHref } from "@/lib/seed-content";
import type { Post } from "@/lib/types";

export function PostMenu({ post, onDeleted }: { post: Post; onDeleted?: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const mine = user?.id === post.authorId;
  const href =
    post.kind === "video" || post.kind === "clip" || post.kind === "note"
      ? watchHref(post.id, { src: "feed" })
      : postPath(post.id, post.kind);

  function url() {
    return `${window.location.origin}${href}`;
  }

  async function share() {
    await shareUrl(url());
    setOpen(false);
  }

  async function copy() {
    await copyUrl(url());
    setNotice("Link copied");
    window.setTimeout(() => setNotice(""), 1600);
    setOpen(false);
  }

  function edit() {
    setOpen(false);
    router.push(`/create?edit=${post.id}`);
  }

  async function remove() {
    if (!window.confirm("Delete this post?")) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(data.error || "Could not delete this post.");
      window.setTimeout(() => setNotice(""), 2500);
      return;
    }
    setOpen(false);
    setNotice("Post deleted");
    onDeleted?.();
    router.refresh();
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-full text-fb-muted"
        aria-label="Post menu"
        onClick={() => setOpen(true)}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {notice ? <span className="absolute top-9 right-0 text-[11px] font-semibold text-fb-muted">{notice}</span> : null}
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="w-full rounded-t-2xl bg-[#f4f1eb] px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-black/20" />
            <button type="button" className="flex h-12 w-full items-center gap-3 px-4 text-left text-sm font-semibold" onClick={() => void share()}>
              <Share2 className="h-5 w-5" />
              Share
            </button>
            <button type="button" className="flex h-12 w-full items-center gap-3 px-4 text-left text-sm font-semibold" onClick={() => void copy()}>
              <Copy className="h-5 w-5" />
              Copy link
            </button>
            {mine ? (
              <>
                <button type="button" className="flex h-12 w-full items-center gap-3 px-4 text-left text-sm font-semibold" onClick={edit}>
                  <Pencil className="h-5 w-5" />
                  Edit post
                </button>
                <button type="button" className="flex h-12 w-full items-center gap-3 px-4 text-left text-sm font-semibold text-red-600" onClick={() => void remove()}>
                  <Trash2 className="h-5 w-5" />
                  Delete post
                </button>
              </>
            ) : null}
            {notice ? <p className="px-4 py-2 text-sm font-semibold">{notice}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
