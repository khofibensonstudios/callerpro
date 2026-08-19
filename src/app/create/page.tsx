"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteChrome } from "@/components/SiteChrome";
import { MediaPostScreen } from "@/components/MediaPostScreen";
import { fileToJpeg, seekAndCapture } from "@/lib/resize-image";
import { clearCreateMedia, peekCreateMedia, takeCreateMedia } from "@/lib/pending-create";
import { mediaFormData } from "@/lib/media-file";
import type { PostKind } from "@/lib/types";

type Mode = Extract<PostKind, "video" | "note">;

function CreateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const start = params.get("kind");
  const editId = params.get("edit");
  const [kind, setKind] = useState<Mode>(start === "video" ? "video" : "note");
  const [body, setBody] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [frame, setFrame] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoFile = useRef<File | null>(null);
  const [clipFile, setClipFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (start === "blog") {
      router.replace("/messages");
      return;
    }
    if (start === "video" || start === "note") setKind(start);
  }, [start, router]);

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/posts/${editId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.post || !d.mine) return;
        const k = d.post.kind as string;
        if (k === "blog") {
          router.replace("/messages");
          return;
        }
        if (k === "video" || k === "note") setKind(k);
        setBody(d.post.body || "");
        setCoverImage(d.post.coverImage || "");
        setVideoUrl(d.post.videoUrl || "");
      })
      .catch(() => {});
  }, [editId]);

  useEffect(() => {
    function applyPending() {
      const pending = peekCreateMedia() || takeCreateMedia();
      if (!pending) return;
      if (pending.kind === "video") onVideo(pending.file);
      else void onPhoto(pending.file);
    }
    applyPending();
    window.addEventListener("connect-create-media", applyPending);
    return () => window.removeEventListener("connect-create-media", applyPending);
  }, []);

  async function captureFrame(time?: number) {
    const video = videoRef.current;
    if (!video) return;
    const shot = await seekAndCapture(video, time ?? frame);
    if (shot) setCoverImage(shot);
  }

  function onVideo(file: File | undefined) {
    if (!file) return;
    setKind("video");
    videoFile.current = file;
    setClipFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setCoverImage("");
    setFrame(0);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setKind("note");
    setCoverImage(await fileToJpeg(file));
    setVideoUrl("");
  }

  async function onCover(file: File | undefined) {
    if (!file) return;
    setCoverImage(await fileToJpeg(file));
  }

  async function saveMedia(opts: {
    published: boolean;
    body: string;
    hashtags: string[];
    taggedUserIds: string[];
    visibility: "everyone" | "followers";
    alsoStory: boolean;
  }) {
    setSaving(true);
    setError("");
    const caption = opts.body.trim();
    const fromTags = opts.hashtags.map((t) => `#${t}`).join(" ");
    const text = [caption, fromTags].filter(Boolean).join(" ") || (kind === "video" ? "Video" : "Photo");
    let postedVideo = videoUrl.startsWith("blob:") ? "" : videoUrl;
    if (kind === "video") {
      const file = clipFile || videoFile.current || peekCreateMedia()?.file || null;
      if (!file) {
        setSaving(false);
        setError("The video is still on this screen, but the phone did not keep the file. Pick it once more, then post.");
        return;
      }
      const up = await fetch("/api/upload", { method: "POST", body: mediaFormData(file, "video"), credentials: "include" });
      const uploaded = await up.json().catch(() => ({}));
      if (!up.ok) {
        setSaving(false);
        setError(uploaded.error || "Could not save the video.");
        return;
      }
      postedVideo = uploaded.url;
    }
    if (kind === "video" && !postedVideo) {
      setSaving(false);
      setError("The video did not save. Try posting again.");
      return;
    }
    let cover = coverImage;
    if (cover.startsWith("data:")) {
      try {
        const blob = await (await fetch(cover)).blob();
        const fd = new FormData();
        fd.append("file", blob, "cover.jpg");
        const up = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
        const uploaded = await up.json();
        if (up.ok) cover = uploaded.url;
        else cover = "";
      } catch {
        cover = "";
      }
    }
    const res = await fetch(editId ? `/api/posts/${editId}` : "/api/posts", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editId
          ? {
              title: caption.slice(0, 140) || (kind === "video" ? "Video" : "Photo"),
              body: text,
              coverImage: cover || undefined,
              visibility: opts.visibility,
              published: opts.published,
            }
          : {
              kind,
              title: caption.slice(0, 140) || (kind === "video" ? "Video" : "Photo"),
              body: text,
              skill: "Storytelling",
              taggedUserIds: opts.taggedUserIds,
              hashtags: opts.hashtags,
              visibility: opts.visibility,
              published: opts.published,
              alsoStory: opts.alsoStory,
              videoUrl: kind === "video" ? postedVideo : undefined,
              coverImage: cover || undefined,
            },
      ),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    clearCreateMedia();
    window.location.assign(opts.published ? "/?posted=1" : "/drafts");
  }

  return (
    <SiteChrome variant="chat" hideBars>
      <MediaPostScreen
        kind={kind === "video" ? "video" : "note"}
        videoUrl={videoUrl}
        coverImage={coverImage}
        videoRef={videoRef}
        onCoverFile={onCover}
        onCaptureFrame={captureFrame}
        duration={duration}
        frame={frame}
        setFrame={setFrame}
        setDuration={setDuration}
        onPublish={saveMedia}
        saving={saving}
        error={error}
        initialCaption={body}
      />
    </SiteChrome>
  );
}

export default function CreatePage() {
  return (
    <Suspense>
      <CreateInner />
    </Suspense>
  );
}
