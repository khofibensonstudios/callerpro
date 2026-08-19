"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { MediaThumb } from "./MediaThumb";
import { PostMenu } from "./PostMenu";
import { PostActions } from "./PostActions";
import { postPath, watchHref } from "@/lib/seed-content";
import { timeAgo } from "@/lib/time";
import type { Post, PublicUser } from "@/lib/types";

export function FeedCard({
  post,
  author,
  from = "feed",
}: {
  post: Post;
  author: PublicUser;
  from?: "feed" | "watch" | "profile";
}) {
  const [gone, setGone] = useState(false);
  if (!author) return null;
  const personHref = `/u/${author.id}`;
  const href =
    post.kind === "video" || post.kind === "clip" || post.kind === "note"
      ? watchHref(post.id, { src: from, author: from === "profile" ? author.id : undefined })
      : postPath(post.id, post.kind);
  const caption = post.body;
  const hasMedia =
    post.kind === "video" ||
    post.kind === "clip" ||
    !!post.coverImage;

  if (gone) {
    return <p className="border-b border-black/[0.06] px-4 py-3 text-sm font-semibold">Post deleted</p>;
  }

  return (
    <article className="border-b border-black/[0.08] bg-white">
      <header className="flex items-center gap-2.5 px-3 py-2.5">
        <Link href={personHref} className="shrink-0">
          <Avatar name={author.name} hue={author.avatarHue} src={author.avatarUrl} size={32} userId={author.id} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={personHref} className="truncate text-[14px] font-semibold">
              {author.name}
            </Link>
          </div>
          <p className="text-[12px] text-fb-muted" suppressHydrationWarning>
            {timeAgo(post.createdAt)}
          </p>
        </div>
        <PostMenu post={post} onDeleted={() => setGone(true)} />
      </header>

      {post.kind === "video" || post.kind === "clip" ? (
        <div className="relative">
          <MediaThumb post={post} autoPlayInView playButton={false} className="aspect-square w-full" />
          <Link
            href={href}
            className="absolute top-0 left-0 bottom-0 z-[1]"
            style={{ right: 72 }}
            aria-label={post.title || "Open video"}
          />
        </div>
      ) : post.coverImage ? (
        <Link href={href} className="block">
          <MediaThumb post={post} playButton={false} className="aspect-square w-full" />
        </Link>
      ) : null}

      <PostActions
        postId={post.id}
        likedBy={post.likedBy ?? []}
        caption={hasMedia ? caption : caption}
        username={author.name}
        commentCount={post.commentCount ?? 0}
        shareHref={href}
        shareTitle={post.title}
      />
    </article>
  );
}
