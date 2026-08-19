"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bookmark, ChevronDown, Heart, MessageCircle, Share2, Volume2, VolumeX } from "lucide-react";
import { Avatar } from "./Avatar";
import { FollowChip } from "./FollowButton";
import { useAuth } from "./AuthProvider";
import { bindMediaUnlock, pauseFeedVideos } from "@/lib/feed-sound";
import { CommentsSheet } from "./CommentsSheet";
import { ShareSheet } from "./ShareSheet";
import type { Post, PublicUser } from "@/lib/types";

export type ReelRow = { post: Post; author: PublicUser };

const MUTE_KEY = "cp_watch_muted";

function writeMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function WatchReel({
  items,
  lockedToAuthor,
}: {
  items: ReelRow[];
  lockedToAuthor?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const videos = useRef<Record<string, HTMLVideoElement | null>>({});
  const skillRef = useRef("");
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const mutedRef = useRef(true);
  const [queue, setQueue] = useState(items);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const armedRef = useRef(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    pauseFeedVideos();
    mutedRef.current = true;
    setMuted(true);
  }, []);

  useEffect(() => {
    setQueue(items);
    activeRef.current = 0;
    setActive(0);
    pausedRef.current = false;
    setPaused(false);
    skillRef.current = "";
  }, [items]);

  useEffect(() => {
    armedRef.current = false;
    const t = window.setTimeout(() => {
      armedRef.current = true;
    }, 600);
    return () => window.clearTimeout(t);
  }, [items]);

  useEffect(() => {
    fetch("/api/saved", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSavedIds(new Set(d.ids ?? [])))
      .catch(() => {});
  }, []);

  function playActive() {
    const current = queueRef.current[activeRef.current];
    const keep = current ? videos.current[current.post.id] : null;
    pauseFeedVideos();
    for (const video of Object.values(videos.current)) {
      if (!video || video === keep) continue;
      video.pause();
      video.muted = true;
    }
    if (!keep) return;
    bindMediaUnlock(keep);
    keep.muted = mutedRef.current;
    if (pausedRef.current) {
      keep.pause();
      return;
    }
    if (!keep.paused) return;
    void keep.play().catch(() => {
      keep.muted = true;
      void keep.play().catch(() => {});
    });
  }

  useEffect(() => {
    activeRef.current = active;
    playActive();
    const t = window.setTimeout(playActive, 80);
    return () => window.clearTimeout(t);
  }, [active, queue]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!hit) return;
        const i = Number((hit.target as HTMLElement).dataset.index);
        if (Number.isNaN(i) || i === activeRef.current) return;
        pausedRef.current = false;
        setPaused(false);
        activeRef.current = i;
        setActive(i);
        const row = queueRef.current[i];
        if (!row) return;
        fetch(`/api/posts/${row.post.id}/view`, { method: "POST" }).catch(() => {});
        const skill = row.post.skill;
        if (skill) document.cookie = `cp_taste=${encodeURIComponent(skill)};path=/;max-age=2592000`;
      },
      { root, threshold: 0.55 },
    );
    const observe = () => {
      io.disconnect();
      root.querySelectorAll("[data-reel]").forEach((el) => io.observe(el));
    };
    observe();
    return () => io.disconnect();
  }, [lockedToAuthor, queue.length]);

  function togglePause() {
    if (!armedRef.current) return;
    const current = queueRef.current[activeRef.current];
    const el = current ? videos.current[current.post.id] : null;
    if (!el) return;
    if (el.paused) {
      pausedRef.current = false;
      setPaused(false);
      el.muted = mutedRef.current;
      el.play().catch(() => {});
    } else {
      pausedRef.current = true;
      setPaused(true);
      el.pause();
    }
  }

  const muteAt = useRef(0);

  function toggleMute(postId: string) {
    const now = Date.now();
    if (now - muteAt.current < 400) return;
    muteAt.current = now;
    const next = !mutedRef.current;
    mutedRef.current = next;
    writeMuted(next);
    setMuted(next);
    const el = videos.current[postId] ?? null;
    for (const video of Object.values(videos.current)) {
      if (!video) continue;
      video.muted = video === el ? next : true;
    }
    if (el) {
      el.muted = next;
      if (!next) void el.play().catch(() => {});
    }
  }

  if (!queue.length) return <p className="p-8 text-white">Nothing here yet.</p>;

  return (
    <div className="relative h-full min-h-0 bg-black">
      <div
        ref={scroller}
        className="hide-scroll h-full snap-y snap-mandatory overflow-y-auto"
      >
        {queue.map((row, i) => {
          const isVideo = !!row.post.videoUrl;
          const photo = row.post.coverImage;
          return (
          <section
            key={row.post.id}
            data-reel
            data-index={i}
            className="relative flex h-full w-full snap-start items-center justify-center bg-black"
          >
            {isVideo ? (
            <video
              ref={(el) => {
                if (el) {
                  videos.current[row.post.id] = el;
                  el.setAttribute("playsinline", "true");
                  el.setAttribute("webkit-playsinline", "true");
                }
              }}
              className="pointer-events-none h-full w-full bg-black object-cover"
              loop
              playsInline
              preload={Math.abs(i - active) <= 1 ? "auto" : "metadata"}
              poster={row.post.coverImage}
              src={Math.abs(i - active) <= 2 ? row.post.videoUrl : undefined}
              onCanPlay={() => {
                if (activeRef.current === i) playActive();
              }}
            />
            ) : photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt={row.post.title || ""}
                className="pointer-events-none h-full w-full bg-black object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-black px-8 text-center text-sm text-white/80">
                This post is not available.
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
            {isVideo ? (
              <>
            <div
              className="absolute z-[4]"
              style={{ top: 0, left: 0, bottom: 0, right: 72, touchAction: "pan-y" }}
              onClick={togglePause}
              role="button"
              tabIndex={0}
              aria-label={paused ? "Play" : "Pause"}
            />
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleMute(row.post.id);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleMute(row.post.id);
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleMute(row.post.id);
              }}
              className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-4 z-30 grid h-12 w-12 place-items-center rounded-full bg-black/55 text-white"
              style={{ touchAction: "manipulation" }}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}
            </button>
            {paused && i === active ? (
              <span className="pointer-events-none absolute inset-0 z-[6] grid place-items-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-black/45">
                  <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 fill-white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            ) : null}
              </>
            ) : null}

            <ReelRail
              row={row}
              saved={savedIds.has(row.post.id)}
              onSaved={(next) => {
                setSavedIds((prev) => {
                  const copy = new Set(prev);
                  if (next) copy.add(row.post.id);
                  else copy.delete(row.post.id);
                  return copy;
                });
              }}
            />

            <div className="absolute inset-x-4 bottom-24 z-10 max-w-[70%] text-white lg:bottom-8">
              <AuthorLiveLine author={row.author} />
              <p className="mt-1 line-clamp-2 text-sm">{row.post.body?.replace(/<[^>]+>/g, " ").trim() || row.post.title}</p>
            </div>

            {i < queue.length - 1 ? (
              <p className="pointer-events-none absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 text-[11px] text-white/40 lg:bottom-2">
                <ChevronDown className="h-4 w-4" /> Scroll for next
              </p>
            ) : null}
          </section>
          );
        })}
      </div>
    </div>
  );
}

function AuthorLiveLine({ author }: { author: PublicUser }) {
  return (
    <div className="flex items-center gap-2">
      <Link href={`/u/${author.id}`} className="text-base font-semibold">
        {author.name}
      </Link>
      <FollowChip userId={author.id} tone="dark" />
    </div>
  );
}

function ReelRail({
  row,
  saved,
  onSaved,
}: {
  row: ReelRow;
  saved: boolean;
  onSaved: (saved: boolean) => void;
}) {
  const { user } = useAuth();
  const personHref = `/u/${row.author.id}`;
  const [likes, setLikes] = useState(row.post.likedBy ?? []);
  const [commentCount, setCommentCount] = useState(row.post.commentCount ?? 0);
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const liked = !!(user && likes.includes(user.id));

  useEffect(() => {
    setLikes(row.post.likedBy ?? []);
    setCommentCount(row.post.commentCount ?? 0);
  }, [row.post.id, row.post.likedBy, row.post.commentCount]);

  function needLogin() {
    if (user) return false;
    window.location.href = "/login";
    return true;
  }

  async function like() {
    if (needLogin()) return;
    const res = await fetch(`/api/posts/${row.post.id}/like`, { method: "POST" });
    const d = await res.json();
    if (res.ok) setLikes(d.likedBy);
  }

  async function save() {
    if (needLogin()) return;
    const res = await fetch(`/api/posts/${row.post.id}/save`, { method: "POST" });
    const d = await res.json();
    if (res.ok) onSaved(!!d.saved);
  }

  const shareUrl =
    typeof window === "undefined" ? `/watch/${row.post.id}` : `${window.location.origin}/watch/${row.post.id}`;

  return (
    <>
      <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-3.5 text-white lg:bottom-28">
        <Link href={personHref} className="rounded-full">
          <Avatar name={row.author.name} hue={row.author.avatarHue} src={row.author.avatarUrl} size={40} userId={row.author.id} />
        </Link>
        <button type="button" onClick={() => void like()} className="flex flex-col items-center gap-0.5">
          <Heart className={`h-7 w-7 ${liked ? "fill-[#e85d04] text-[#e85d04]" : ""}`} />
          <span className="text-[12px] font-semibold">{likes.length}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (needLogin()) return;
            setOpen(true);
          }}
          className="flex flex-col items-center gap-0.5"
        >
          <MessageCircle className="h-7 w-7" />
          <span className="text-[12px] font-semibold">{commentCount}</span>
        </button>
        <button type="button" onClick={() => setShareOpen(true)} className="flex flex-col items-center gap-0.5" aria-label="Share">
          <Share2 className="h-6 w-6" />
        </button>
        <button type="button" onClick={() => void save()} className="flex flex-col items-center gap-0.5">
          <Bookmark className={`h-6 w-6 ${saved ? "fill-white" : ""}`} />
        </button>
      </div>
      <CommentsSheet postId={row.post.id} open={open} onClose={() => setOpen(false)} onCount={setCommentCount} />
      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} url={shareUrl} title={row.post.title} />
    </>
  );
}
