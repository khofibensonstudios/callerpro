let muted = true;
const feedVideos = new Set<HTMLVideoElement>();
const listeners = new Set<(muted: boolean) => void>();
let activeFeed: HTMLVideoElement | null = null;
let unlockEl: HTMLVideoElement | null = null;
let unlockBound = false;

export function isFeedMuted() {
  return muted;
}

export function subscribeFeedMute(fn: (muted: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function pauseFeedVideos() {
  for (const video of feedVideos) {
    video.pause();
    video.muted = true;
  }
}

export function pauseOtherFeedVideos(keep: HTMLVideoElement | null) {
  for (const video of feedVideos) {
    if (video === keep) continue;
    video.pause();
    video.muted = true;
  }
}

export function registerFeedVideo(video: HTMLVideoElement) {
  feedVideos.add(video);
  video.muted = true;
}

export function unregisterFeedVideo(video: HTMLVideoElement) {
  feedVideos.delete(video);
  if (activeFeed === video) activeFeed = null;
  if (unlockEl === video) unlockEl = null;
}

export function setActiveFeedVideo(video: HTMLVideoElement | null) {
  activeFeed = video;
  bindMediaUnlock(video);
}

export function bindMediaUnlock(video: HTMLVideoElement | null) {
  if (video) unlockEl = video;
  if (typeof window === "undefined" || unlockBound) return;
  unlockBound = true;
  const prime = () => {
    const v = unlockEl;
    if (!v || !v.paused) return;
    v.playsInline = true;
    v.muted = true;
    void v.play().catch(() => {});
  };
  window.addEventListener("touchstart", prime, { capture: true, passive: true });
}

export function applyFeedMute(video: HTMLVideoElement) {
  video.muted = muted || video !== activeFeed;
}

export function toggleFeedMute(target?: HTMLVideoElement | null) {
  muted = !muted;
  if (target) {
    activeFeed = target;
    unlockEl = target;
  }
  const play = !muted ? (target || activeFeed) : null;
  for (const video of feedVideos) {
    if (play && video === play) {
      video.muted = false;
      void video.play().catch(() => {});
    } else {
      video.muted = true;
    }
  }
  listeners.forEach((fn) => fn(muted));
  return muted;
}
