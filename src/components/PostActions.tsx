"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Heart, MessageCircle, Share2 } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { CommentsSheet } from "./CommentsSheet";
import { ShareSheet } from "./ShareSheet";

export function PostActions({
  postId,
  likedBy,
  caption,
  username,
  commentCount = 0,
  shareHref,
  shareTitle,
}: {
  postId: string;
  likedBy: string[];
  caption?: string;
  username?: string;
  commentCount?: number;
  shareHref?: string;
  shareTitle?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [likes, setLikes] = useState(likedBy);
  const [count, setCount] = useState(commentCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [live, setLive] = useState(false);
  const liked = live && !!(user && likes.includes(user.id));

  useEffect(() => {
    setLive(true);
  }, []);

  useEffect(() => {
    setLikes(likedBy);
  }, [likedBy]);

  useEffect(() => {
    setCount(commentCount);
  }, [commentCount]);

  function needUser() {
    if (user) return false;
    router.push("/login");
    return true;
  }

  async function toggleLike() {
    if (needUser()) return;
    const res = await fetch(`/api/posts/${postId}/like`, {
      method: "POST",
      credentials: "include",
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(d.likedBy)) setLikes(d.likedBy);
  }

  async function toggleSave() {
    if (needUser()) return;
    const res = await fetch(`/api/posts/${postId}/save`, { method: "POST", credentials: "include" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setSaved(!!d.saved);
  }

  const url =
    typeof window === "undefined"
      ? shareHref || `/p/${postId}`
      : `${window.location.origin}${shareHref || `/p/${postId}`}`;

  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-4 py-2">
        <button type="button" onClick={() => void toggleLike()} aria-label="Like" className="active:scale-90">
          <Heart className={`h-[26px] w-[26px] ${liked ? "fill-[#e85d04] text-[#e85d04]" : "text-[#141414]"}`} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (needUser()) return;
            setCommentsOpen(true);
          }}
          aria-label="Comments"
          className="active:scale-90"
        >
          <MessageCircle className="h-[26px] w-[26px]" />
        </button>
        <button type="button" onClick={() => setShareOpen(true)} aria-label="Share" className="active:scale-90">
          <Share2 className="h-[24px] w-[24px]" />
        </button>
        <button type="button" onClick={() => void toggleSave()} aria-label="Save" className="ml-auto active:scale-90">
          <Bookmark className={`h-[24px] w-[24px] ${saved ? "fill-[#141414]" : ""}`} />
        </button>
      </div>
      {likes.length > 0 ? (
        <p className="text-[14px] font-semibold">
          {likes.length.toLocaleString()} {likes.length === 1 ? "like" : "likes"}
        </p>
      ) : null}
      {caption ? (
        <p className="mt-1 text-[14px] leading-5">
          {username ? <span className="mr-1.5 font-semibold">{username}</span> : null}
          <span>{caption}</span>
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          if (needUser()) return;
          setCommentsOpen(true);
        }}
        className="mt-1 text-[14px] text-fb-muted"
      >
        {count} {count === 1 ? "comment" : "comments"}
      </button>
      <button
        type="button"
        onClick={() => {
          if (needUser()) return;
          setCommentsOpen(true);
        }}
        className="mt-2 block w-full border-t border-black/[0.06] pt-2 text-left text-[14px] text-fb-muted"
      >
        Add a comment…
      </button>
      <CommentsSheet postId={postId} open={commentsOpen} onClose={() => setCommentsOpen(false)} onCount={setCount} />
      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} url={url} title={shareTitle || "Connect Pro"} />
    </div>
  );
}
