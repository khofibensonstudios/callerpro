type FsVideo = HTMLVideoElement & {
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
  requestVideoFrameCallback?: (cb: () => void) => number;
};

export function attachInlineVideo(video: HTMLVideoElement) {
  if (video.dataset.cpInline === "1") return;
  video.dataset.cpInline = "1";
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("x-webkit-airplay", "deny");
  video.disablePictureInPicture = true;
  const anyVid = video as FsVideo;
  const exitFs = (e?: Event) => {
    e?.preventDefault?.();
    if (anyVid.webkitDisplayingFullscreen) anyVid.webkitExitFullscreen?.();
  };
  video.addEventListener("webkitbeginfullscreen", exitFs);
}

export async function waitForVideoFrame(video: HTMLVideoElement) {
  const anyVid = video as FsVideo;
  if (anyVid.requestVideoFrameCallback) {
    await Promise.race([
      new Promise<void>((resolve) => anyVid.requestVideoFrameCallback!(() => resolve())),
      new Promise<void>((resolve) => window.setTimeout(resolve, 700)),
    ]);
    return;
  }
  await Promise.race([
    new Promise<void>((resolve) => {
      const done = () => {
        video.removeEventListener("timeupdate", done);
        video.removeEventListener("canplay", done);
        resolve();
      };
      video.addEventListener("timeupdate", done);
      video.addEventListener("canplay", done);
    }),
    new Promise<void>((resolve) => window.setTimeout(resolve, 700)),
  ]);
}

export async function primeInlinePlayback(video: HTMLVideoElement) {
  attachInlineVideo(video);
  try {
    await video.play();
  } catch {
    /* muted inline play can still be blocked until a tap */
  }
  await waitForVideoFrame(video);
  video.pause();
}

function looksBlank(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const samples = 16;
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const x = Math.min(w - 1, Math.floor(((i + 0.5) / samples) * w));
    const y = Math.min(h - 1, Math.floor(((((i * 5) % samples) + 0.5) / samples) * h));
    const p = ctx.getImageData(x, y, 1, 1).data;
    sum += p[0] + p[1] + p[2];
  }
  return sum / (samples * 3) < 8;
}

export async function grabVideoFrame(video: HTMLVideoElement, quality = 0.72) {
  if (!video.videoWidth || !video.videoHeight) return "";
  const max = 1280;
  let w = video.videoWidth;
  let h = video.videoHeight;
  if (w > max) {
    h = (h * max) / w;
    w = max;
  }
  if (h > max) {
    w = (w * max) / h;
    h = max;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  try {
    if (typeof createImageBitmap === "function") {
      const bmp = await createImageBitmap(video);
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
  } catch {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }
  if (looksBlank(ctx, canvas.width, canvas.height)) return "";
  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return "";
  }
}

export async function seekAndCapture(video: HTMLVideoElement, time: number) {
  await primeInlinePlayback(video);
  const end = Math.max(0.05, (video.duration || 1) - 0.05);
  const t = Math.min(Math.max(0.05, time), end);
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    try {
      video.currentTime = t;
    } catch {
      done();
    }
    window.setTimeout(done, 900);
  });
  await waitForVideoFrame(video);
  return grabVideoFrame(video);
}

export function fileToJpeg(file: File, max = 1280, quality = 0.82) {
  return new Promise<string>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const fail = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    };
    img.onerror = fail;
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > max) {
        h = (h * max) / w;
        w = max;
      }
      if (h > max) {
        w = (w * max) / h;
        h = max;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        fail();
      }
    };
    img.src = url;
  });
}

export function sanitizeBlogHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}
