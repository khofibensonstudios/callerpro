/** Natural phone camera — sharper defaults for live. */
export async function openLiveCamera(facing: "user" | "environment") {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const videoBase = {
    facingMode: { ideal: facing },
    width: { ideal: 1280, min: 640 },
    height: { ideal: 720, min: 360 },
    frameRate: { ideal: 30, max: 30 },
  };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      video: videoBase,
    });
    stream.getVideoTracks().forEach((t) => {
      try {
        t.contentHint = "motion";
      } catch {
        /* ignore */
      }
    });
    stream.getAudioTracks().forEach((t) => {
      t.enabled = true;
      try {
        t.contentHint = "speech";
      } catch {
        /* ignore */
      }
    });
    return stream;
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch {
      return null;
    }
  }
}

/** Mic only — permission when guest taps to talk. */
export async function openLiveMic() {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      video: false,
    }).then((stream) => {
      stream.getAudioTracks().forEach((t) => {
        try {
          t.contentHint = "speech";
        } catch {
          /* ignore */
        }
      });
      return stream;
    });
  } catch {
    return null;
  }
}

/** Camera only — permission when guest taps to show face. */
export async function openLiveVideo(facing: "user" | "environment" = "user") {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 360 },
        frameRate: { ideal: 30, max: 30 },
      },
    });
    stream.getVideoTracks().forEach((t) => {
      try {
        t.contentHint = "motion";
      } catch {
        /* ignore */
      }
    });
    return stream;
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    } catch {
      return null;
    }
  }
}

/** Full-bleed live frame. Mirror front camera only. */
export function fitLiveVideo(el: HTMLVideoElement | null, mirror: boolean) {
  if (!el) return;
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.objectFit = "cover";
  el.style.objectPosition = "center center";
  el.style.transform = mirror ? "scaleX(-1)" : "";
}
