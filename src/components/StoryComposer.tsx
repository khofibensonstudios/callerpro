"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Music, Type, X } from "lucide-react";
import { mediaFormData } from "@/lib/media-file";

const TRACKS = ["Original audio", "Night drive", "Soft morning", "City walk"];

export function StoryComposer({
  startPhoto,
  startVideo,
  videoFile,
  onClose,
  onShared,
}: {
  startPhoto?: string;
  startVideo?: string;
  videoFile?: File | null;
  onClose: () => void;
  onShared?: (row: { post: { id: string; kind: string; title: string; body: string; coverImage?: string; videoUrl?: string; createdAt: string; authorId: string } ; author: { id: string; name: string; avatarHue: number; avatarUrl?: string } }) => void;
}) {
  const [ready, setReady] = useState(false);
  const [photo] = useState(startPhoto || "");
  const [videoUrl] = useState(startVideo || "");
  const [caption, setCaption] = useState("");
  const [music, setMusic] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setReady(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function share() {
    if (!photo && !videoUrl) return;
    setSaving(true);
    setError("");
    try {
      let cover = photo;
      if (photo.startsWith("data:")) {
        const blob = await (await fetch(photo)).blob();
        const fd = new FormData();
        fd.append("file", new File([blob], "story.jpg", { type: blob.type || "image/jpeg" }));
        const up = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
        const uploaded = await up.json();
        if (!up.ok) {
          setSaving(false);
          setError(uploaded.error || "Could not save the photo.");
          return;
        }
        cover = uploaded.url;
      }
      let postedVideo = videoUrl.startsWith("blob:") ? "" : videoUrl;
      if (videoFile) {
        const up = await fetch("/api/upload", { method: "POST", body: mediaFormData(videoFile, "video"), credentials: "include" });
        const uploaded = await up.json();
        if (!up.ok) {
          setSaving(false);
          setError(uploaded.error || "Could not save the video.");
          return;
        }
        postedVideo = uploaded.url;
      }
      if (videoUrl && !postedVideo) {
        setSaving(false);
        setError("Pick the video again, then share.");
        return;
      }
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "story",
          title: caption.trim() || music || "Story",
          body: [caption.trim(), music].filter(Boolean).join(" · ") || "Story",
          coverImage: cover || undefined,
          videoUrl: postedVideo || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setSaving(false);
      if (!res.ok) {
        setError(data.error || "Could not share this story.");
        return;
      }
      onShared?.(data);
      onClose();
    } catch {
      setSaving(false);
      setError("Could not share this story. Try again.");
    }
  }

  if (!ready || (!photo && !videoUrl)) return null;

  return createPortal(
    <div className="fixed inset-0 z-[400] bg-black">
      <div className="relative mx-auto h-[100dvh] w-full overflow-hidden md:w-[min(100vw,calc(100dvh*9/16))]">
        {videoUrl ? (
          <video src={videoUrl} className="h-full w-full object-cover" autoPlay loop muted playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/55 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-10">
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full text-white"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          <p className="text-sm font-semibold text-white">Edit story</p>
          <button
            type="button"
            disabled={saving}
            onClick={share}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            {saving ? "Sharing" : "Share"}
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 space-y-3 bg-gradient-to-t from-black/80 px-4 pt-16 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-white/70" />
            <input
              className="h-11 min-w-0 flex-1 rounded-full bg-white/15 px-4 text-sm text-white outline-none placeholder:text-white/45"
              placeholder="Write something"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto hide-scroll">
            <Music className="h-4 w-4 shrink-0 text-white/70" />
            {TRACKS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMusic(music === t ? "" : t)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  music === t ? "bg-white text-black" : "bg-white/15 text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
