"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Camera, Heart, Image as ImageIcon, MessageCircle, Plus, Share2, Video, X } from "lucide-react";
import Link from "next/link";
import { FollowChip } from "./FollowButton";
import { Avatar } from "./Avatar";
import { useAuth } from "./AuthProvider";
import { StoryComposer } from "./StoryComposer";
import { HiddenFileInput } from "./HiddenFileInput";
import { shareUrl } from "@/lib/share";
import { fileToJpeg } from "@/lib/resize-image";
import type { Post, PublicUser } from "@/lib/types";

export type StoryItem = { post: Post; author: PublicUser };

const DAY_MS = 24 * 60 * 60 * 1000;

function liveStories(items: StoryItem[]) {
  const cutoff = Date.now() - DAY_MS;
  return items.filter((item) => +new Date(item.post.createdAt) > cutoff);
}

function groupStories(items: StoryItem[]) {
  const order: string[] = [];
  const map = new Map<string, StoryItem[]>();
  for (const item of liveStories(items)) {
    const id = item.author.id;
    if (!map.has(id)) {
      order.push(id);
      map.set(id, []);
    }
    map.get(id)!.push(item);
  }
  return order.map((id) => map.get(id)!);
}

function isAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export function StoriesRow({ items }: { items: StoryItem[] }) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [shot, setShot] = useState("");
  const [clip, setClip] = useState("");
  const [clipFile, setClipFile] = useState<File | null>(null);
  const [androidPick, setAndroidPick] = useState(false);
  const [mine, setMine] = useState<StoryItem[]>([]);
  const [notice, setNotice] = useState("");
  const pickRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const grouped = groupStories([...mine, ...items]);
  const mineGroup = grouped.find((g) => g[0]?.author.id === user?.id) ?? null;
  const others = grouped.filter((g) => g[0]?.author.id !== user?.id);
  const groups = mineGroup ? [mineGroup, ...others] : others;
  const hasMine = !!mineGroup;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("story") === "me" && hasMine) setOpen(0);
  }, [hasMine]);

  useEffect(() => {
    function openMine() {
      if (hasMine) setOpen(0);
    }
    window.addEventListener("connect-open-my-story", openMine);
    return () => window.removeEventListener("connect-open-my-story", openMine);
  }, [hasMine]);

  function addStory() {
    setNotice("");
    if (isAndroid()) {
      setAndroidPick(true);
      return;
    }
    pickRef.current?.click();
  }

  async function useFile(file: File | undefined) {
    if (!file) return;
    const type = file.type || "";
    if (type.startsWith("video")) {
      setClipFile(file);
      setClip(URL.createObjectURL(file));
      setShot("");
      setNotice("");
      return;
    }
    if (type.startsWith("image")) {
      setClipFile(null);
      setClip("");
      setShot(await fileToJpeg(file, 1440, 0.86));
      setNotice("");
      return;
    }
    setNotice("Use a photo or a video. Documents cannot be posted as a story.");
  }

  return (
    <>
      <div className="hide-scroll mb-1 flex gap-4 overflow-x-auto px-3 py-3">
        <div className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
          <span className="relative">
            <button
              type="button"
              onClick={() => (hasMine ? setOpen(0) : addStory())}
              className="block"
              aria-label={hasMine ? "View your story" : "Add story"}
            >
              {hasMine ? (
                <span className="block rounded-full bg-[conic-gradient(#e85d04,#ff3b30,#f4a261,#e85d04)] p-[2.5px]">
                  <span className="block rounded-full bg-white p-[2px]">
                    <Avatar name={user?.name || "You"} hue={user?.avatarHue || 28} src={user?.avatarUrl} size={58} userId={user?.id} />
                  </span>
                </span>
              ) : (
                <span className="grid h-[66px] w-[66px] place-items-center rounded-full bg-[#ebe6de]">
                  <Avatar name={user?.name || "You"} hue={user?.avatarHue || 28} src={user?.avatarUrl} size={62} userId={user?.id} />
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={addStory}
              className="absolute right-0 bottom-0 grid h-5 w-5 place-items-center rounded-full bg-[#e85d04] text-white ring-2 ring-white"
              aria-label="Add story"
            >
              <Plus className="h-3 w-3" strokeWidth={3} />
            </button>
          </span>
          <span className="w-full truncate text-center text-[11px] font-medium">Your story</span>
        </div>
        {others.map((group) => {
          const item = group[0];
          const idx = groups.findIndex((g) => g[0]?.author.id === item.author.id);
          return (
          <button
            key={item.author.id}
            type="button"
            onClick={() => setOpen(idx)}
            className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
          >
            <span className="rounded-full bg-[conic-gradient(#e85d04,#ff3b30,#f4a261,#e85d04)] p-[2.5px]">
              <span className="block rounded-full bg-white p-[2px]">
                <Avatar name={item.author.name} hue={item.author.avatarHue} src={item.author.avatarUrl} size={58} userId={item.author.id} />
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px]">{item.author.name.split(" ")[0]}</span>
          </button>
          );
        })}
      </div>
      {open !== null ? (
        <StoryPlayer groups={groups} start={open} onClose={() => setOpen(null)} />
      ) : null}
      {shot || clip ? (
        <StoryComposer
          startPhoto={shot || undefined}
          startVideo={clip || undefined}
          videoFile={clipFile}
          onShared={(data) => {
            if (data?.post && data?.author) {
              setMine((prev) => [{ post: data.post as StoryItem["post"], author: data.author as StoryItem["author"] }, ...prev]);
              window.dispatchEvent(new Event("connect-story-posted"));
            }
            setNotice("Your story is up.");
            window.setTimeout(() => setNotice(""), 2500);
          }}
          onClose={() => {
            setShot("");
            setClip("");
            setClipFile(null);
            router.refresh();
          }}
        />
      ) : null}
      {notice ? (
        <p className="mb-3 text-sm font-semibold">{notice}</p>
      ) : null}
      {androidPick
        ? createPortal(
            <div
              className="fixed inset-0 z-[400] flex items-end bg-black/50"
              onClick={() => setAndroidPick(false)}
            >
              <div
                className="w-full rounded-t-2xl bg-[#f4f1eb] px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-black/20" />
                <p className="px-4 pb-1 text-sm font-semibold">Add story</p>
                <button
                  type="button"
                  className="flex h-14 w-full items-center gap-3 px-4 text-left"
                  onClick={() => {
                    photoRef.current?.click();
                    setAndroidPick(false);
                  }}
                >
                  <Camera className="h-5 w-5" />
                  Camera
                </button>
                <button
                  type="button"
                  className="flex h-14 w-full items-center gap-3 px-4 text-left"
                  onClick={() => {
                    videoRef.current?.click();
                    setAndroidPick(false);
                  }}
                >
                  <Video className="h-5 w-5" />
                  Video
                </button>
                <button
                  type="button"
                  className="flex h-14 w-full items-center gap-3 px-4 text-left"
                  onClick={() => {
                    pickRef.current?.click();
                    setAndroidPick(false);
                  }}
                >
                  <ImageIcon className="h-5 w-5" />
                  Gallery
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      <HiddenFileInput
        inputRef={pickRef}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          void useFile(file);
        }}
      />
      <HiddenFileInput
        inputRef={photoRef}
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          void useFile(file);
        }}
      />
      <HiddenFileInput
        inputRef={videoRef}
        accept="video/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          void useFile(file);
        }}
      />
    </>
  );
}

function StoryPlayer({
  groups,
  start,
  onClose,
}: {
  groups: StoryItem[][];
  start: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [g, setG] = useState(start);
  const [s, setS] = useState(0);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [dragY, setDragY] = useState(0);
  const touch = useRef({ x: 0, y: 0, dragging: false });
  const group = groups[g] ?? [];
  const item = group[s];
  const duration = item?.post.videoUrl ? 15000 : 5000;
  const [likes, setLikes] = useState<string[]>(item?.post.likedBy ?? []);
  const liked = !!(user && likes.includes(user.id));
  const videoRef = useRef<HTMLVideoElement>(null);
  const replyRef = useRef<HTMLInputElement>(null);
  const elapsed = useRef(0);
  const runStarted = useRef(Date.now());
  const holdAt = useRef(0);

  useEffect(() => {
    setReady(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    setLikes(item?.post.likedBy ?? []);
    setReplyOpen(false);
    setText("");
    setSent(false);
    setDragY(0);
    elapsed.current = 0;
    runStarted.current = Date.now();
  }, [item?.post.id]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused || replyOpen) v.pause();
    else void v.play().catch(() => {});
  }, [paused, replyOpen, item?.post.id]);

  function goNextStory() {
    if (s < group.length - 1) {
      setS(s + 1);
      return;
    }
    if (g < groups.length - 1) {
      setG(g + 1);
      setS(0);
      return;
    }
    onClose();
  }

  function goPrevStory() {
    if (s > 0) {
      setS(s - 1);
      return;
    }
    if (g > 0) {
      const prev = groups[g - 1];
      setG(g - 1);
      setS(Math.max(0, prev.length - 1));
    }
  }

  function goNextUser() {
    if (g < groups.length - 1) {
      setG(g + 1);
      setS(0);
      return;
    }
    onClose();
  }

  function goPrevUser() {
    if (g > 0) {
      setG(g - 1);
      setS(0);
    }
  }

  useEffect(() => {
    if (paused || replyOpen || !item || dragY > 8) return;
    runStarted.current = Date.now();
    const left = Math.max(80, duration - elapsed.current);
    const t = window.setTimeout(goNextStory, left);
    return () => {
      window.clearTimeout(t);
      elapsed.current += Date.now() - runStarted.current;
    };
  }, [g, s, paused, replyOpen, dragY, item?.post.id, duration, groups.length]);

  async function toggleLike() {
    if (!user) {
      onClose();
      router.push("/login");
      return;
    }
    const res = await fetch(`/api/posts/${item.post.id}/like`, { method: "POST" });
    const d = await res.json();
    if (res.ok) {
      setLikes(d.likedBy);
      item.post.likedBy = d.likedBy;
    }
  }

  function openReply() {
    if (!user) {
      onClose();
      router.push("/login");
      return;
    }
    if (user.id === item.author.id) return;
    setReplyOpen(true);
    setPaused(true);
    window.setTimeout(() => replyRef.current?.focus(), 50);
  }

  async function share() {
    const result = await shareUrl(`${window.location.origin}/p/${item.post.id}`);
    if (result === "copied") {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      onClose();
      router.push("/login");
      return;
    }
    const note = text.trim();
    if (!note) return;
    if (user.id === item.author.id) {
      setText("");
      setReplyOpen(false);
      return;
    }
    const res = await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: item.author.id,
        body: `Replied to your story: ${note}`,
      }),
    });
    if (res.ok) {
      setText("");
      setSent(true);
      setReplyOpen(false);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("input,textarea,button,a,form")) return;
    touch.current = { x: e.clientX, y: e.clientY, dragging: true };
    holdAt.current = Date.now();
    setPaused(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!touch.current.dragging) return;
    const dy = e.clientY - touch.current.y;
    const dx = e.clientX - touch.current.x;
    if (dy > 8 && dy > Math.abs(dx)) setDragY(dy);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!touch.current.dragging) return;
    const dy = e.clientY - touch.current.y;
    const dx = e.clientX - touch.current.x;
    const held = Date.now() - holdAt.current;
    touch.current.dragging = false;
    if (dy < -50 && Math.abs(dy) > Math.abs(dx)) {
      setDragY(0);
      openReply();
      return;
    }
    if (dy > 90 && dy > Math.abs(dx)) {
      onClose();
      return;
    }
    setDragY(0);
    setPaused(false);
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNextUser();
      else goPrevUser();
      return;
    }
    if (held > 280) return;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) {
      const box = e.currentTarget.getBoundingClientRect();
      if (e.clientX - box.left < box.width / 3) goPrevStory();
      else if (e.clientX - box.left > (box.width * 2) / 3) goNextStory();
    }
  }

  if (!item || !ready) return null;

  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black">
      <div
        className="relative h-[100dvh] w-full touch-none overflow-hidden bg-black md:w-[min(100vw,calc(100dvh*9/16))]"
        style={{ transform: `translateY(${dragY}px)`, opacity: Math.max(0.35, 1 - dragY / 420) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-[190] grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="absolute inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] z-20 flex gap-1">
          {group.map((_, idx) => (
            <span key={item.author.id + idx} className="h-0.5 flex-1 overflow-hidden rounded bg-white/30">
              <span
                key={idx === s ? item.post.id : idx}
                className={`block h-full bg-white ${idx < s ? "w-full" : idx === s ? "story-bar" : "w-0"}`}
                style={
                  idx === s
                    ? { animationDuration: `${duration}ms`, animationPlayState: paused || replyOpen ? "paused" : "running" }
                    : undefined
                }
              />
            </span>
          ))}
        </div>
        {item.post.videoUrl ? (
          <video ref={videoRef} src={item.post.videoUrl} className="pointer-events-none h-full w-full object-cover" autoPlay muted playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.post.coverImage} alt="" className="pointer-events-none h-full w-full object-cover" />
        )}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 px-4 pt-16 pb-[max(1rem,env(safe-area-inset-bottom))] text-white">
          <div className="mb-2 flex items-center gap-2">
            <Link href={`/u/${item.author.id}`} className="rounded-full">
              <Avatar name={item.author.name} hue={item.author.avatarHue} src={item.author.avatarUrl} size={32} userId={item.author.id} />
            </Link>
            <Link href={`/u/${item.author.id}`} className="font-semibold">
              {item.author.name}
            </Link>
            <FollowChip userId={item.author.id} tone="dark" />
          </div>
          <p className="text-sm">{item.post.title}</p>
          <div className="mt-3 flex items-center gap-1">
            <button type="button" onClick={toggleLike} className="grid h-11 w-11 place-items-center" aria-label="Like">
              <Heart className={`h-6 w-6 ${liked ? "fill-white" : ""}`} />
            </button>
            {user?.id !== item.author.id ? (
              <button type="button" onClick={openReply} className="grid h-11 w-11 place-items-center" aria-label="Reply">
                <MessageCircle className="h-6 w-6" />
              </button>
            ) : null}
            <button type="button" onClick={() => void share()} className="grid h-11 w-11 place-items-center" aria-label="Share">
              <Share2 className="h-6 w-6" />
            </button>
            {copied ? <span className="text-xs">Copied</span> : null}
            {sent ? <span className="text-xs">Reply sent</span> : null}
          </div>
          {user?.id !== item.author.id ? (
            <form onSubmit={send} className="mt-2 flex gap-2">
              <input
                ref={replyRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => {
                  setReplyOpen(true);
                  setPaused(true);
                }}
                placeholder={`Reply to ${item.author.name.split(" ")[0]}`}
                className="h-10 flex-1 rounded-full bg-white/15 px-3 text-sm text-white outline-none placeholder:text-white/60"
              />
              <button type="submit" className="h-10 rounded-full bg-white px-4 text-sm font-semibold text-black">
                Send
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
