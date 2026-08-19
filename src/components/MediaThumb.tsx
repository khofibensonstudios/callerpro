"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { Post } from "@/lib/types";
import {
  applyFeedMute,
  isFeedMuted,
  pauseFeedVideos,
  pauseOtherFeedVideos,
  registerFeedVideo,
  setActiveFeedVideo,
  subscribeFeedMute,
  toggleFeedMute,
  unregisterFeedVideo,
} from "@/lib/feed-sound";

let playingEl: HTMLVideoElement | null = null;

export function MediaThumb({
  post,
  className = "aspect-video",
  playButton = true,
  autoPlayInView = false,
}: {
  post: Post;
  className?: string;
  playButton?: boolean;
  autoPlayInView?: boolean;
}) {
  const isVideo = post.kind === "video" || post.kind === "clip";
  const thumb = post.coverImage;
  const clip = isVideo ? post.videoUrl : undefined;
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inViewRef = useRef(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (!autoPlayInView) return;
    setMuted(isFeedMuted());
    const unsub = subscribeFeedMute(setMuted);
    return () => {
      unsub();
    };
  }, [autoPlayInView]);

  useEffect(() => {
    if (!autoPlayInView || !clip) return;
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap || !video) return;

    video.loop = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    registerFeedVideo(video);

    const playNow = () => {
      if (!inViewRef.current) return;
      setActiveFeedVideo(video);
      pauseOtherFeedVideos(video);
      if (playingEl && playingEl !== video) {
        playingEl.pause();
        playingEl.muted = true;
      }
      playingEl = video;
      applyFeedMute(video);
      if (!video.paused) return;
      void video.play().catch(() => {
        video.muted = true;
        void video.play().catch(() => {});
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const on = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        inViewRef.current = on;
        if (on) playNow();
        else {
          video.pause();
          video.muted = true;
          if (playingEl === video) playingEl = null;
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(wrap);

    return () => {
      io.disconnect();
      unregisterFeedVideo(video);
      video.pause();
      video.muted = true;
      if (playingEl === video) playingEl = null;
    };
  }, [autoPlayInView, clip]);

  useEffect(() => {
    if (!autoPlayInView) return;
    const stop = () => pauseFeedVideos();
    const onHide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", stop);
    };
  }, [autoPlayInView]);

  const muteAt = useRef(0);

  function onMute(e: { preventDefault: () => void; stopPropagation: () => void }) {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - muteAt.current < 400) return;
    muteAt.current = now;
    setMuted(toggleFeedMute(videoRef.current));
  }

  return (
    <div ref={wrapRef} className={`relative overflow-hidden bg-[#ebe6de] ${className}`}>
      {clip ? (
        <video
          ref={videoRef}
          src={clip}
          loop
          playsInline
          preload={autoPlayInView ? "auto" : "metadata"}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      ) : thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt={post.title} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-sm text-fb-muted">No media</div>
      )}
      {autoPlayInView && clip ? (
        <button
          type="button"
          data-feed-mute
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={onMute}
          onTouchEnd={onMute}
          onClick={onMute}
          className="absolute top-3 right-3 z-20 grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white"
          style={{ touchAction: "manipulation" }}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      ) : null}
      {playButton && isVideo && !autoPlayInView ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/95 shadow">
            <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-black">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      ) : null}
    </div>
  );
}
