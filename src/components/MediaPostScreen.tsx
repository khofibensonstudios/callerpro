"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, ChevronLeft, ChevronRight, Folder, Globe, Hash, Settings, Upload } from "lucide-react";
import { PeopleTagger } from "./PeopleTagger";
import { attachInlineVideo, primeInlinePlayback } from "@/lib/resize-image";

type Person = {
  id: string;
  name: string;
  headline?: string;
  avatarUrl?: string;
  avatarHue: number;
};

export function MediaPostScreen({
  kind,
  videoUrl,
  coverImage,
  videoRef,
  onCoverFile,
  onCaptureFrame,
  duration,
  frame,
  setFrame,
  setDuration,
  onPublish,
  saving,
  error,
  initialCaption = "",
}: {
  kind: "note" | "video";
  videoUrl: string;
  coverImage: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onCoverFile: (file: File | undefined) => void;
  onCaptureFrame: (time?: number) => void | Promise<void>;
  duration: number;
  frame: number;
  setFrame: (n: number) => void;
  setDuration: (n: number) => void;
  onPublish: (opts: {
    published: boolean;
    body: string;
    hashtags: string[];
    taggedUserIds: string[];
    visibility: "everyone" | "followers";
    alsoStory: boolean;
  }) => void;
  saving: boolean;
  error: string;
  initialCaption?: string;
}) {
  const router = useRouter();
  const coverInput = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState(initialCaption ?? "");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [tagged, setTagged] = useState<Person[]>([]);
  const [visibility, setVisibility] = useState<"everyone" | "followers">("everyone");
  const [alsoStory, setAlsoStory] = useState(false);
  const [panel, setPanel] = useState<"off" | "hash" | "mention" | "audience" | "settings" | "cover">("off");
  const captureTimer = useRef(0);

  function bindClip(el: HTMLVideoElement | null) {
    (videoRef as { current: HTMLVideoElement | null }).current = el;
    if (el) attachInlineVideo(el);
  }

  useEffect(() => {
    if (initialCaption) setBody(initialCaption);
  }, [initialCaption]);

  useEffect(() => {
    if (panel !== "cover" || kind !== "video") return;
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    void (async () => {
      await primeInlinePlayback(v);
      if (cancelled) return;
      setDuration(v.duration || 0);
      const t = frame || 0.1;
      try {
        v.currentTime = t;
      } catch {
        /* ignore */
      }
      await onCaptureFrame(t);
    })();
    return () => {
      cancelled = true;
    };
  }, [panel]);

  function addHashtag() {
    const t = tagDraft.replace(/^#/, "").trim().replace(/\s+/g, "");
    if (!t) return;
    setHashtags((prev) => (prev.includes(t) ? prev : [...prev, t].slice(0, 20)));
    setTagDraft("");
  }

  const ready = kind === "video" ? !!videoUrl : !!coverImage;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <div className="flex h-12 items-center px-2">
        <button type="button" onClick={() => router.back()} className="grid h-11 w-11 place-items-center" aria-label="Back">
          <ChevronLeft className="h-7 w-7" />
        </button>
      </div>

      <div className="flex gap-3 px-4">
        <textarea
          className="min-h-28 flex-1 resize-none text-[16px] outline-none placeholder:text-black/35"
          placeholder="Add description..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="relative h-[132px] w-[92px] shrink-0 rounded-lg bg-black [transform:translateZ(0)]">
          {kind === "video" && videoUrl && panel !== "cover" ? (
            <video
              ref={(el) => bindClip(el)}
              src={videoUrl}
              muted
              playsInline
              autoPlay
              preload="auto"
              controls={false}
              disablePictureInPicture
              className="pointer-events-none h-full w-full rounded-lg object-cover [transform:translate3d(0,0,0)]"
              onLoadedMetadata={(e) => {
                setDuration(e.currentTarget.duration || 0);
                void primeInlinePlayback(e.currentTarget);
              }}
            />
          ) : null}
          {kind !== "video" && coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImage} alt="" className="h-full w-full rounded-lg object-cover" />
          ) : null}
          {!coverImage && !(kind === "video" && videoUrl) ? (
            <span className="grid h-full place-items-center text-xs text-white/70">No media</span>
          ) : null}
          <span className="pointer-events-none absolute inset-x-0 top-0 z-[2] rounded-t-lg bg-black/35 py-1 text-center text-[11px] font-semibold text-white">
            Preview
          </span>
          <button
            type="button"
            className="absolute inset-x-1 bottom-1 z-[2] rounded bg-black/55 py-1 text-center text-[10px] font-semibold text-white"
            onClick={() => {
              if (kind === "video") setPanel("cover");
              else coverInput.current?.click();
            }}
          >
            {kind === "video" ? "Edit thumbnail" : "Edit cover"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-2 px-4">
        <button
          type="button"
          onClick={() => setPanel("hash")}
          className="flex h-9 items-center gap-1.5 rounded-full bg-[#f2f2f2] px-3 text-sm font-medium"
        >
          <Hash className="h-4 w-4" />
          Hashtags
        </button>
        <button
          type="button"
          onClick={() => setPanel("mention")}
          className="flex h-9 items-center gap-1.5 rounded-full bg-[#f2f2f2] px-3 text-sm font-medium"
        >
          <AtSign className="h-4 w-4" />
          Mention
        </button>
      </div>
      {hashtags.length || tagged.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5 px-4">
          {hashtags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setHashtags((prev) => prev.filter((x) => x !== t))}
              className="rounded-full bg-[#f4f1eb] px-2 py-0.5 text-xs font-semibold"
            >
              #{t}
            </button>
          ))}
          {tagged.map((p) => (
            <span key={p.id} className="rounded-full bg-[#f4f1eb] px-2 py-0.5 text-xs font-semibold">
              @{p.name.split(" ")[0]}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 divide-y divide-black/8 border-t border-black/8">
        <button type="button" onClick={() => setPanel("settings")} className="flex h-14 w-full items-center gap-3 px-4 text-left">
          <Settings className="h-5 w-5 text-black/55" />
          <span className="flex-1 text-[15px]">Ads settings</span>
          <ChevronRight className="h-5 w-5 text-black/30" />
        </button>
        <button type="button" onClick={() => setPanel("audience")} className="flex h-14 w-full items-center gap-3 px-4 text-left">
          <Globe className="h-5 w-5 text-black/55" />
          <span className="flex-1 text-[15px]">
            {visibility === "everyone" ? "Everyone can view this post" : "Followers can view this post"}
          </span>
          <ChevronRight className="h-5 w-5 text-black/30" />
        </button>
        <label className="flex h-14 w-full items-center gap-3 px-4">
          <span className="flex-1 text-[15px]">Post on story</span>
          <button
            type="button"
            role="switch"
            aria-checked={alsoStory}
            onClick={() => setAlsoStory((v) => !v)}
            className={`relative h-7 w-12 rounded-full ${alsoStory ? "bg-[#141414]" : "bg-black/20"}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${alsoStory ? "left-5" : "left-0.5"}`} />
          </button>
        </label>
      </div>

      {error ? <p className="px-4 pt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-auto flex gap-3 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={saving || !ready}
          onClick={() =>
            onPublish({
              published: false,
              body,
              hashtags,
              taggedUserIds: tagged.map((p) => p.id),
              visibility,
              alsoStory: false,
            })
          }
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[#f2f2f2] text-[16px] font-semibold disabled:opacity-40"
        >
          <Folder className="h-5 w-5" />
          Drafts
        </button>
        <button
          type="button"
          disabled={saving || !ready}
          onClick={() =>
            onPublish({
              published: true,
              body,
              hashtags,
              taggedUserIds: tagged.map((p) => p.id),
              visibility,
              alsoStory,
            })
          }
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[#141414] text-[16px] font-semibold text-white disabled:opacity-40"
        >
          <Upload className="h-5 w-5" />
          {saving ? "Posting" : "Post"}
        </button>
      </div>

      <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => onCoverFile(e.target.files?.[0])} />

      {panel !== "off" ? (
        <div className="fixed inset-0 z-[410] flex items-end bg-black/40" onClick={() => setPanel("off")}>
          <div
            className="max-h-[78vh] w-full overflow-y-auto rounded-t-2xl bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
            {panel === "hash" ? (
              <>
                <p className="mb-3 font-semibold">Hashtags</p>
                <div className="flex gap-2">
                  <input
                    className="h-11 flex-1 rounded-xl bg-[#f4f1eb] px-3 text-sm outline-none"
                    placeholder="fashion"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHashtag())}
                  />
                  <button type="button" onClick={addHashtag} className="rounded-xl bg-accent px-4 text-sm font-semibold text-white">
                    Add
                  </button>
                </div>
              </>
            ) : null}
            {panel === "mention" ? (
              <>
                <p className="mb-3 font-semibold">Mention</p>
                <PeopleTagger selected={tagged} onChange={setTagged} />
              </>
            ) : null}
            {panel === "audience" ? (
              <>
                <p className="mb-3 font-semibold">Who can view this post</p>
                <button
                  type="button"
                  className={`mb-2 h-12 w-full rounded-xl px-4 text-left text-sm font-semibold ${visibility === "everyone" ? "bg-[#f4f1eb]" : "bg-white"}`}
                  onClick={() => {
                    setVisibility("everyone");
                    setPanel("off");
                  }}
                >
                  Everyone
                </button>
                <button
                  type="button"
                  className={`h-12 w-full rounded-xl px-4 text-left text-sm font-semibold ${visibility === "followers" ? "bg-[#f4f1eb]" : "bg-white"}`}
                  onClick={() => {
                    setVisibility("followers");
                    setPanel("off");
                  }}
                >
                  Followers
                </button>
              </>
            ) : null}
            {panel === "settings" ? (
              <>
                <p className="mb-2 font-semibold">Ads settings</p>
                <p className="text-sm text-fb-muted">You can set how ads appear on this post later.</p>
              </>
            ) : null}
            {panel === "cover" && kind === "video" && videoUrl ? (
              <>
                <p className="mb-3 font-semibold">Edit thumbnail</p>
                <div className="mb-3 h-56 w-full rounded-xl bg-black [transform:translateZ(0)]">
                  <video
                    ref={(el) => bindClip(el)}
                    src={videoUrl}
                    muted
                    playsInline
                    preload="auto"
                    controls={false}
                    disablePictureInPicture
                    className="h-full w-full rounded-xl object-contain [transform:translate3d(0,0,0)]"
                    onLoadedMetadata={(e) => {
                      setDuration(e.currentTarget.duration || 0);
                      void primeInlinePlayback(e.currentTarget);
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(duration, 0.1)}
                  step={0.05}
                  value={frame}
                  className="w-full accent-[#141414]"
                  onInput={(e) => {
                    const t = Number((e.target as HTMLInputElement).value);
                    setFrame(t);
                    const v = videoRef.current;
                    if (v) v.currentTime = t;
                  }}
                  onChange={(e) => {
                    const t = Number(e.target.value);
                    setFrame(t);
                    const v = videoRef.current;
                    if (v) v.currentTime = t;
                    window.clearTimeout(captureTimer.current);
                    captureTimer.current = window.setTimeout(() => {
                      void onCaptureFrame(t);
                    }, 120);
                  }}
                />
                <button
                  type="button"
                  className="mt-3 h-11 w-full rounded-xl bg-[#141414] text-sm font-semibold text-white"
                  onClick={async () => {
                    await onCaptureFrame(frame);
                    setPanel("off");
                  }}
                >
                  Use this frame
                </button>
                <button
                  type="button"
                  className="mt-2 h-11 w-full rounded-xl bg-[#f4f1eb] text-sm font-semibold"
                  onClick={() => coverInput.current?.click()}
                >
                  Choose photo
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
