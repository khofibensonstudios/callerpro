"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  FileText,
  Image as ImageIcon,
  MapPin,
  Mic,
  Paperclip,
  Phone,
  SendHorizontal,
  Square,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { SiteChrome } from "@/components/SiteChrome";
import { Avatar } from "@/components/Avatar";
import { PersonLink } from "@/components/PersonLink";
import { LeraChatPanel, LeraEntryButton } from "@/components/LeraChatPanel";
import { StoriesRowClient } from "@/components/StoriesRowClient";
import { useAuth } from "@/components/AuthProvider";
import { HiddenFileInput } from "@/components/HiddenFileInput";
import { EmojiComposerButton } from "@/components/EmojiPicker";
import { useCallSession } from "@/components/CallSession";
import { SaveContactSheet } from "@/components/SaveContactSheet";
import { VoiceNotePlayer } from "@/components/VoiceNotePlayer";
import type { InboxItem } from "@/lib/inbox-shared";
import type { Post, PublicUser } from "@/lib/types";

type ChatMessage = { id: string; fromId: string; body: string; createdAt?: string };

const IMG_PREFIX = "<<img>>";
const AUDIO_PREFIX = "<<audio>>";

function parseMedia(body: string): {
  kind: "text" | "image" | "audio";
  text: string;
  url?: string;
} {
  if (body.startsWith(IMG_PREFIX)) return { kind: "image", text: "", url: body.slice(IMG_PREFIX.length) };
  if (body.startsWith(AUDIO_PREFIX)) return { kind: "audio", text: "", url: body.slice(AUDIO_PREFIX.length) };
  return { kind: "text", text: body };
}

function previewBody(body: string) {
  if (body.startsWith(IMG_PREFIX)) return "📷 Photo";
  if (body.startsWith(AUDIO_PREFIX)) return "🎙 Voice message";
  return body;
}

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function clockTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dayKey(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday.getTime() - startMsg.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-[3px] px-1">
      <span className="h-[5px] w-[5px] animate-bounce rounded-full bg-[#8a8580]" style={{ animationDelay: "0ms" }} />
      <span className="h-[5px] w-[5px] animate-bounce rounded-full bg-[#8a8580]" style={{ animationDelay: "150ms" }} />
      <span className="h-[5px] w-[5px] animate-bounce rounded-full bg-[#8a8580]" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

function ChatImage({ src, mine, onClick }: { src: string; mine: boolean; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative block w-fit max-w-[70%] overflow-hidden rounded-2xl ${mine ? "ml-auto" : ""}`}
    >
      {!loaded && !error && (
        <div className="flex h-48 w-48 items-center justify-center rounded-2xl bg-[#f0ede8]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d1cdc7] border-t-[#141414]" />
        </div>
      )}
      {error && (
        <div className="flex h-32 w-40 items-center justify-center rounded-2xl bg-[#f0ede8] text-[13px] text-[#8a8580]">
          Could not load
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`max-h-72 max-w-full rounded-2xl object-cover shadow-sm ${loaded ? "" : "hidden"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </button>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <SiteChrome variant="chat">
          <div className="h-full bg-white" />
        </SiteChrome>
      }
    >
      <MessagesInner />
    </Suspense>
  );
}

function MessagesInner() {
  const { user } = useAuth();
  const { call, startCall } = useCallSession();
  const router = useRouter();
  const params = useSearchParams();
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState<string | null>(params.get("t"));
  const [leraOpen, setLeraOpen] = useState(params.get("lera") === "1");
  const [activeOther, setActiveOther] = useState<InboxItem["other"] | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [findId, setFindId] = useState("");
  const [findError, setFindError] = useState("");
  const [saveWho, setSaveWho] = useState<{ userId: string; callerId: string; threadId: string } | null>(null);
  const [stories, setStories] = useState<{ post: Post; author: PublicUser }[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [selectedMsg, setSelectedMsg] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const mediaRec = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recTimer = useRef<number | null>(null);
  const recStartedAt = useRef(0);
  const typingTimer = useRef<number | null>(null);
  const knownIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    setActive(params.get("t"));
    setLeraOpen(params.get("lera") === "1");
    if (params.get("add") === "1") {
      window.setTimeout(() => findInputRef.current?.focus(), 50);
    }
  }, [params]);

  useEffect(() => {
    function focusFind() { findInputRef.current?.focus(); }
    window.addEventListener("connect-find-person", focusFind);
    return () => window.removeEventListener("connect-find-person", focusFind);
  }, []);

  useEffect(() => {
    fetch("/api/feed", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const items = (d.feed ?? []) as { post: Post; author: PublicUser }[];
        setStories(items.filter((i) => i.post.kind === "story"));
      })
      .catch(() => {});
  }, []);

  const panelOpen = Boolean(active) || leraOpen;

  async function refreshInbox() {
    const res = await fetch("/api/inbox", { credentials: "include" });
    const d = await res.json().catch(() => ({}));
    setInbox(d.items ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    void refreshInbox();
    const t = window.setInterval(() => {
      if (!document.hidden && !active) void refreshInbox();
    }, 3000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!active) {
      setMessages([]);
      setOtherOnline(false);
      setOtherTyping(false);
      setSelectedMsg(null);
      knownIds.current = new Set();
      void refreshInbox();
      return;
    }
    let stop = false;
    async function load() {
      const res = await fetch(`/api/inbox/${active}`, { credentials: "include" });
      const d = await res.json().catch(() => ({}));
      if (stop) return;
      const list: ChatMessage[] = d.messages ?? [];
      const prevCount = knownIds.current.size;
      setMessages(list);
      knownIds.current = new Set(list.map((m) => m.id));
      setOtherOnline(Boolean(d.otherOnline));
      setOtherTyping(Boolean(d.otherTyping));
      if (d.other) setActiveOther(d.other);
      setInbox((items) => {
        const last = list[list.length - 1];
        if (!last) return items.map((it) => (it.threadId === active ? { ...it, unread: false } : it));
        const mine = Boolean(user?.id && last.fromId === user.id);
        const next = items.map((it) =>
          it.threadId === active
            ? { ...it, unread: false, at: last.createdAt || new Date().toISOString(), preview: mine ? `You: ${previewBody(last.body)}` : previewBody(last.body) }
            : it,
        );
        if (list.length > prevCount) return [...next].sort((a, b) => +new Date(b.at) - +new Date(a.at));
        return next;
      });
    }
    void load();
    const t = window.setInterval(() => { if (!document.hidden) void load(); }, 800);
    const beat = window.setInterval(() => {
      void fetch("/api/chat/presence", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    }, 12_000);
    return () => { stop = true; window.clearInterval(t); window.clearInterval(beat); };
  }, [active, user?.id]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, otherTyping, active]);

  function signalTyping(on: boolean) {
    if (!active) return;
    void fetch("/api/chat/presence", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(on ? { typingThread: active } : { typing: false }),
    });
  }

  function onDraftChange(value: string) {
    setText(value);
    if (!active) return;
    signalTyping(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => signalTyping(false), 1800);
  }

  async function markActivity(item: InboxItem) {
    if (!item.activityId) return;
    const res = await fetch("/api/inbox", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId: item.activityId }),
    });
    const d = await res.json().catch(() => ({}));
    if (d.items) setInbox(d.items);
    else setInbox((list) => list.map((it) => (it.id === item.id ? { ...it, unread: false } : it)));
  }

  async function findByCallerId(raw?: string) {
    const digits = (raw ?? findId).replace(/\D/g, "");
    if (digits.length !== 6) { setFindError("Enter a 6-digit caller ID."); return; }
    setFindError("");
    const res = await fetch("/api/inbox", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callerId: digits }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.thread?.id) { setFindError(d.error || "No account with that caller ID."); return; }
    setFindId("");
    setLeraOpen(false);
    const otherId = d.other?.id as string | undefined;
    if (otherId) {
      const check = await fetch(`/api/contacts?userId=${encodeURIComponent(otherId)}`, { credentials: "include" });
      const c = await check.json().catch(() => ({}));
      if (!c.contact) { setSaveWho({ userId: otherId, callerId: digits, threadId: d.thread.id }); return; }
    }
    setActive(d.thread.id);
    router.push(`/messages?t=${d.thread.id}`);
    void refreshInbox();
  }

  async function openThreadWith(userId: string, other?: InboxItem["other"]) {
    const existing = inbox.find((it) => it.kind === "chat" && !it.isGroup && it.other.id === userId);
    if (existing?.threadId) {
      if (other || existing.other) setActiveOther(other || existing.other);
      setLeraOpen(false);
      setActive(existing.threadId);
      router.push(`/messages?t=${existing.threadId}`);
      return;
    }
    const res = await fetch("/api/inbox", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.thread?.id) {
      if (other) setActiveOther(other);
      setLeraOpen(false);
      setActive(d.thread.id);
      router.push(`/messages?t=${d.thread.id}`);
      void refreshInbox();
    }
  }

  async function openItem(item: InboxItem) {
    if (item.kind !== "chat" && item.kind !== "follow") {
      await markActivity(item);
      if (item.postId) router.push(`/p/${item.postId}`);
      else router.push(`/u/${item.other.id}`);
      return;
    }
    if (item.kind === "follow") {
      await markActivity(item);
      await openThreadWith(item.other.id, item.other);
      return;
    }
    if (!item.threadId) return;
    setLeraOpen(false);
    setActiveOther(item.other);
    setActive(item.threadId);
    router.push(`/messages?t=${item.threadId}`);
  }

  function openLera() {
    setActive(null);
    setActiveOther(null);
    setSelectedMsg(null);
    setLeraOpen(true);
    router.push("/messages?lera=1");
  }

  function closePanel() {
    setActive(null);
    setActiveOther(null);
    setSelectedMsg(null);
    setLeraOpen(false);
    router.replace("/messages");
  }

  async function pushMessage(body: string) {
    if (!active) return false;
    const res = await fetch(`/api/inbox/${active}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.message) return false;
    setMessages((m) => (knownIds.current.has(d.message.id) ? m : [...m, d.message]));
    knownIds.current.add(d.message.id);
    const now = new Date().toISOString();
    setInbox((list) => {
      const next = list.map((item) =>
        item.threadId === active
          ? { ...item, preview: `You: ${previewBody(body)}`, at: now, unread: false }
          : item,
      );
      return [...next].sort((a, b) => +new Date(b.at) - +new Date(a.at));
    });
    signalTyping(false);
    return true;
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!active || !text.trim()) return;
    const body = text.trim();
    setText("");
    const ok = await pushMessage(body);
    if (!ok) setText(body);
    requestAnimationFrame(() => textInputRef.current?.focus({ preventScroll: true }));
  }

  async function uploadAndSend(file: File, kind: "image" | "audio") {
    if (!active || uploading) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      const data = await up.json().catch(() => ({}));
      if (!up.ok || !data.url) return;
      const body = kind === "image" ? `${IMG_PREFIX}${data.url}` : `${AUDIO_PREFIX}${data.url}`;
      await pushMessage(body);
    } finally {
      setUploading(false);
    }
  }

  function startRecording() {
    if (recording || uploading || !navigator.mediaDevices?.getUserMedia) return;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";
        const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
        recChunks.current = [];
        recStartedAt.current = Date.now();
        rec.ondataavailable = (ev) => { if (ev.data.size) recChunks.current.push(ev.data); };
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const elapsed = Date.now() - recStartedAt.current;
          const blob = new Blob(recChunks.current, { type: rec.mimeType || "audio/webm" });
          if (elapsed < 500 || blob.size < 200) return;
          const file = new File([blob], `voice-${Date.now()}.weba`, { type: "audio/webm" });
          void uploadAndSend(file, "audio");
        };
        mediaRec.current = rec;
        rec.start();
        setRecording(true);
        setRecSecs(0);
        recTimer.current = window.setInterval(() => setRecSecs((s) => s + 1), 1000);
      } catch {}
    })();
  }

  function stopRecording() {
    if (recTimer.current) window.clearInterval(recTimer.current);
    recTimer.current = null;
    setRecording(false);
    setRecSecs(0);
    if (mediaRec.current && mediaRec.current.state !== "inactive") mediaRec.current.stop();
    mediaRec.current = null;
  }

  function cancelRecording() {
    if (recTimer.current) window.clearInterval(recTimer.current);
    recTimer.current = null;
    setRecording(false);
    setRecSecs(0);
    if (mediaRec.current) {
      mediaRec.current.ondataavailable = null;
      mediaRec.current.onstop = () => {};
      if (mediaRec.current.state !== "inactive") mediaRec.current.stop();
    }
    mediaRec.current = null;
  }

  const other = useMemo(() => {
    if (activeOther) return activeOther;
    return inbox.find((r) => r.threadId === active)?.other || null;
  }, [activeOther, inbox, active]);
  const me = user?.id;
  const chats = inbox.filter((i) => i.kind === "chat" && !i.isGroup);
  const activity = inbox.filter((i) => i.kind !== "chat");

  function statusLine() {
    if (call) return "In a call";
    if (otherTyping) return "typing…";
    if (otherOnline) return "Online";
    return "";
  }

  return (
    <SiteChrome variant="chat" hideBars={panelOpen}>
      <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-white">
        {/* ── Sidebar ── */}
        <aside
          className={`flex min-h-0 w-full flex-col md:w-[360px] md:border-r md:border-black/8 ${panelOpen ? "hidden md:flex" : "flex"}`}
        >
          <div className="flex shrink-0 items-center gap-3 px-4 py-3">
            <h1 className="shrink-0 text-2xl font-bold tracking-tight">Chats</h1>
            <form
              className="min-w-0 flex-1"
              onSubmit={(e) => { e.preventDefault(); void findByCallerId(); }}
            >
              <input
                ref={findInputRef}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={findId}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setFindId(next);
                  setFindError("");
                  if (next.length === 6) void findByCallerId(next);
                }}
                placeholder="Search caller ID"
                className="h-10 w-full rounded-full bg-[#f4f1eb] px-4 text-[15px] outline-none"
              />
            </form>
          </div>
          {findError ? <p className="px-4 pb-2 text-sm text-red-700">{findError}</p> : null}
          <div className="hide-scroll min-h-0 flex-1 overflow-y-auto">
            <StoriesRowClient items={stories} />
            {!loaded ? (
              <p className="px-5 py-8 text-sm text-fb-muted">Loading…</p>
            ) : (
              <>
                {chats.length ? <p className="px-4 pb-1 pt-1 text-[11px] font-semibold tracking-wide text-fb-muted uppercase">Messages</p> : null}
                {chats.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void openItem(item)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      active && item.threadId === active ? "bg-[#f4f1eb]" : "hover:bg-[#faf8f4]"
                    }`}
                  >
                    <Avatar name={item.other.name} hue={item.other.avatarHue} src={item.other.avatarUrl} size={52} userId={item.other.id} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate ${item.unread ? "font-bold" : "font-semibold"}`}>{item.other.name}</span>
                        <span className="shrink-0 text-[11px] text-fb-muted">{timeAgo(item.at)}</span>
                      </span>
                      <span className={`mt-0.5 block truncate text-[13px] ${item.unread ? "font-semibold text-[#141414]" : "text-fb-muted"}`}>
                        {item.preview}
                      </span>
                    </span>
                    {item.unread ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#e85d04]" /> : null}
                  </button>
                ))}

                {activity.length ? <p className="mt-3 px-4 pb-1 text-[11px] font-semibold tracking-wide text-fb-muted uppercase">Activity</p> : null}
                {activity.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void openItem(item)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#faf8f4]"
                  >
                    <Avatar name={item.other.name} hue={item.other.avatarHue} src={item.other.avatarUrl} size={52} userId={item.other.id} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate ${item.unread ? "font-bold" : "font-semibold"}`}>{item.other.name}</span>
                        <span className="shrink-0 text-[11px] text-fb-muted">{timeAgo(item.at)}</span>
                      </span>
                      <span className={`mt-0.5 block truncate text-[13px] ${item.unread ? "font-semibold text-[#141414]" : "text-fb-muted"}`}>
                        {item.kind === "follow" ? "Followed you · Tap to message" : item.preview}
                      </span>
                    </span>
                    {item.unread ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#e85d04]" /> : null}
                  </button>
                ))}

                {inbox.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-fb-muted">Your messages will show up here.</p>
                ) : null}
              </>
            )}
          </div>
        </aside>

        {/* ── Chat panel ── */}
        <section
          id="chat-thread"
          className={
            panelOpen
              ? "fixed inset-0 z-50 flex min-h-0 flex-col bg-[#f8f6f2] pt-[env(safe-area-inset-top,0px)] md:static md:z-auto md:flex-1 md:pt-0"
              : "hidden md:flex md:h-full md:min-h-0 md:flex-1 md:flex-col md:bg-[#f8f6f2]"
          }
        >
          {leraOpen ? (
            <LeraChatPanel onBack={closePanel} />
          ) : (
            <>
              {/* Header */}
              <header className="flex shrink-0 items-center justify-between border-b border-black/6 bg-white px-2 py-2 shadow-sm">
                <div className="flex min-w-0 items-center gap-1">
                  {other ? (
                    <>
                      <button
                        type="button"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-black/5 md:hidden"
                        aria-label="Back"
                        onClick={closePanel}
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <PersonLink userId={other.id} className="flex min-w-0 items-center gap-2.5 rounded-lg pr-2 hover:bg-black/[0.03]">
                        <span className="relative shrink-0">
                          <Avatar name={other.name} hue={other.avatarHue} src={other.avatarUrl} size={40} userId={other.id} />
                          {otherOnline && (
                            <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold leading-tight">{other.name}</p>
                          {statusLine() && (
                            <p className={`text-[12px] ${otherTyping ? "text-[#e85d04]" : "text-fb-muted"}`}>
                              {otherTyping ? <TypingDots /> : statusLine()}
                            </p>
                          )}
                        </div>
                      </PersonLink>
                    </>
                  ) : (
                    <p className="px-2 font-semibold text-fb-muted">Select a chat</p>
                  )}
                </div>
                {other && (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5"
                      title="Video call"
                      disabled={!!call}
                      onClick={() => {
                        if (!other || !active || call) return;
                        startCall({ threadId: active, role: "caller", incoming: false, mode: "video", other });
                      }}
                    >
                      <Video className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5"
                      title="Voice call"
                      disabled={!!call}
                      onClick={() => {
                        if (!other || !active || call) return;
                        startCall({ threadId: active, role: "caller", incoming: false, mode: "audio", other });
                      }}
                    >
                      <Phone className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </header>

              {/* Messages list */}
              <div ref={listRef} className="hide-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
                {messages.map((m, idx) => {
                  const mine = m.fromId === me;
                  const media = parseMedia(m.body);
                  const prev = messages[idx - 1];
                  const showDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                  const showTime = selectedMsg === m.id;
                  const isLast = idx === messages.length - 1;
                  const isConsecutive = prev && prev.fromId === m.fromId && !showDay;

                  return (
                    <div key={m.id} className={isConsecutive ? "mt-0.5" : "mt-3"}>
                      {showDay && (
                        <div className="mb-3 flex justify-center">
                          <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium text-[#8a8580] shadow-sm backdrop-blur-sm">
                            {dayLabel(m.createdAt)}
                          </span>
                        </div>
                      )}

                      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        {media.kind === "image" && media.url ? (
                          <div className={`max-w-[70%] ${mine ? "" : ""}`}>
                            <ChatImage
                              src={media.url}
                              mine={mine}
                              onClick={() => { setSelectedMsg(m.id); setLightbox(media.url!); }}
                            />
                            <p className={`mt-0.5 px-1 text-[10px] text-[#8a8580] ${mine ? "text-right" : ""}`}>
                              {clockTime(m.createdAt)}
                              {mine && isLast && <CheckCheck className="ml-1 inline h-3 w-3 text-[#e85d04]" />}
                            </p>
                          </div>
                        ) : media.kind === "audio" && media.url ? (
                          <div className={mine ? "ml-auto" : ""}>
                            <VoiceNotePlayer
                              src={media.url}
                              mine={mine}
                              time={clockTime(m.createdAt)}
                            />
                            {mine && isLast && (
                              <p className="mt-0.5 text-right text-[10px] text-[#8a8580]">
                                <CheckCheck className="inline h-3 w-3 text-[#e85d04]" />
                              </p>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedMsg((id) => (id === m.id ? null : m.id))}
                            className={`block w-fit max-w-[75%] text-left text-[15px] leading-[1.35] ${
                              mine
                                ? "rounded-[20px] rounded-br-md bg-[#141414] px-3.5 py-2 text-white"
                                : "rounded-[20px] rounded-bl-md bg-white px-3.5 py-2 text-[#141414] shadow-sm"
                            }`}
                          >
                            <span className="whitespace-pre-wrap break-words">{media.text}</span>
                            <span className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-white/40" : "text-[#8a8580]"}`}>
                              {clockTime(m.createdAt)}
                              {mine && isLast && <CheckCheck className="h-3 w-3 text-[#e85d04]" />}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {otherTyping && (
                  <div className="mt-3 flex justify-start">
                    <div className="rounded-[20px] rounded-bl-md bg-white px-4 py-2.5 shadow-sm">
                      <TypingDots />
                    </div>
                  </div>
                )}
              </div>

              {/* Attach menu */}
              {attachOpen && (
                <div className="shrink-0 border-t border-black/6 bg-white px-4 py-3">
                  <div className="grid grid-cols-4 gap-4">
                    <AttachOption icon={Camera} label="Camera" color="bg-rose-500" onClick={() => { setAttachOpen(false); cameraRef.current?.click(); }} />
                    <AttachOption icon={ImageIcon} label="Gallery" color="bg-violet-500" onClick={() => { setAttachOpen(false); galleryRef.current?.click(); }} />
                    <AttachOption icon={MapPin} label="Location" color="bg-emerald-500" onClick={() => {
                      setAttachOpen(false);
                      if (!navigator.geolocation) return;
                      navigator.geolocation.getCurrentPosition(
                        (pos) => { void pushMessage(`📍 Location: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`); },
                        () => {},
                        { enableHighAccuracy: true },
                      );
                    }} />
                    <AttachOption icon={FileText} label="Document" color="bg-blue-500" onClick={() => { setAttachOpen(false); }} />
                  </div>
                </div>
              )}

              {/* Composer */}
              {other && (
                <div className="shrink-0 border-t border-black/6 bg-white px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                  <HiddenFileInput
                    inputRef={cameraRef}
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) void uploadAndSend(f, "image"); }}
                  />
                  <HiddenFileInput
                    inputRef={galleryRef}
                    accept="image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) void uploadAndSend(f, "image"); }}
                  />
                  {recording ? (
                    <div className="flex items-center gap-2 px-1">
                      <button
                        type="button"
                        onClick={cancelRecording}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-red-500 hover:bg-red-50"
                        aria-label="Cancel recording"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                        <span className="font-mono text-[15px] font-semibold tabular-nums text-red-600">
                          {Math.floor(recSecs / 60)}:{(recSecs % 60).toString().padStart(2, "0")}
                        </span>
                        <span className="text-[13px] text-fb-muted">Recording…</span>
                      </div>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#25d366] text-white shadow-md"
                        aria-label="Send voice note"
                      >
                        <SendHorizontal className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={(e) => void send(e)} className="flex items-end gap-1">
                      <div className="relative min-w-0 flex-1">
                        <div className="flex items-center rounded-full bg-[#f4f1eb]">
                          <EmojiComposerButton
                            open={emojiOpen}
                            setOpen={(v) => { setEmojiOpen(v); setAttachOpen(false); }}
                            onPick={(emoji) => {
                              setText((t) => { const next = t + emoji; onDraftChange(next); return next; });
                            }}
                          />
                          <input
                            ref={textInputRef}
                            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#b0aca6]"
                            value={text}
                            onChange={(e) => onDraftChange(e.target.value)}
                            onFocus={() => { setEmojiOpen(false); setAttachOpen(false); }}
                            placeholder={uploading ? "Sending…" : "Message"}
                            enterKeyHint="send"
                          />
                          <button
                            type="button"
                            disabled={uploading}
                            onClick={() => { setAttachOpen((v) => !v); setEmojiOpen(false); }}
                            className="grid h-10 w-10 shrink-0 place-items-center text-[#8a8580]"
                            aria-label="Attach"
                          >
                            <Paperclip className="h-[21px] w-[21px]" />
                          </button>
                          {!text.trim() && (
                            <button
                              type="button"
                              disabled={uploading}
                              onClick={() => { setAttachOpen(false); cameraRef.current?.click(); }}
                              className="grid h-10 w-10 shrink-0 place-items-center text-[#8a8580]"
                              title="Camera"
                            >
                              <Camera className="h-[21px] w-[21px]" />
                            </button>
                          )}
                        </div>
                      </div>
                      {text.trim() ? (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => void send()}
                          className="mb-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e85d04] text-white shadow-md"
                          aria-label="Send"
                        >
                          <SendHorizontal className="h-5 w-5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={startRecording}
                          className="mb-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e85d04] text-white shadow-md"
                          aria-label="Record voice note"
                        >
                          <Mic className="h-[21px] w-[21px]" />
                        </button>
                      )}
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Lera FAB */}
      {!panelOpen && (
        <div className="pointer-events-none fixed right-4 bottom-[calc(5.6rem+env(safe-area-inset-bottom))] z-[180] lg:right-8 lg:bottom-8">
          <div className="pointer-events-auto">
            <LeraEntryButton active={leraOpen} onClick={openLera} />
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/95" onClick={() => setLightbox(null)}>
          <div className="flex items-center justify-end px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"
              onClick={() => setLightbox(null)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid flex-1 place-items-center px-3 pb-8" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        </div>
      )}

      {/* Save contact sheet */}
      {saveWho && (
        <SaveContactSheet
          userId={saveWho.userId}
          callerId={saveWho.callerId}
          onSaved={() => {
            const threadId = saveWho.threadId;
            setSaveWho(null);
            setActive(threadId);
            router.push(`/messages?t=${threadId}`);
            void refreshInbox();
          }}
          onSkip={() => {
            const threadId = saveWho.threadId;
            setSaveWho(null);
            setActive(threadId);
            router.push(`/messages?t=${threadId}`);
            void refreshInbox();
          }}
        />
      )}
    </SiteChrome>
  );
}

function AttachOption({ icon: Icon, label, color, onClick }: { icon: typeof Camera; label: string; color: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span className={`grid h-12 w-12 place-items-center rounded-full text-white ${color}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[11px] font-medium text-[#6f6a64]">{label}</span>
    </button>
  );
}
