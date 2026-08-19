"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { Avatar } from "./Avatar";
import { LiveStageChrome } from "./LiveStageChrome";
import { SpeakingWave } from "./SpeakingWave";
import type { LiveSession } from "@/lib/live";
import { openLiveMic, openLiveVideo, fitLiveVideo } from "@/lib/live-camera";
import { LIVE_ICE, asIceCandidate, asSessionDescription, sdpPayload } from "@/lib/live-webrtc";

export function LiveViewer({ initial }: { initial: LiveSession }) {
  const router = useRouter();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const selfRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const guestPcRef = useRef<RTCPeerConnection | null>(null);
  const guestStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const guestSeenRef = useRef<Set<string>>(new Set());
  const [session, setSession] = useState(initial);
  const [status, setStatus] = useState<"connecting" | "live" | "ended" | "error">(
    initial.status === "live" ? "connecting" : "ended",
  );
  const [error, setError] = useState("");
  const [hint, setHint] = useState("Connecting to live…");
  const [needSound, setNeedSound] = useState(false);
  const needSoundRef = useRef(false);
  const [guestMode, setGuestMode] = useState(false);
  const [guestStatus, setGuestStatus] = useState<"off" | "requested" | "accepted" | "rejected">("off");
  const [guestMicOn, setGuestMicOn] = useState(false);
  const [guestCamOn, setGuestCamOn] = useState(false);
  const [guestStreamTick, setGuestStreamTick] = useState(0);
  const [camPreview, setCamPreview] = useState(false);
  const [spotlightPeer, setSpotlightPeer] = useState<string | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const guestMicOnRef = useRef(false);
  const guestCamOnRef = useRef(false);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);

  function attachRemote(track: MediaStreamTrack, streams: readonly MediaStream[]) {
    const video = videoRef.current;
    if (!video) return;
    let remote = remoteStreamRef.current;
    if (!remote) {
      remote = streams[0] ? streams[0] : new MediaStream();
      remoteStreamRef.current = remote;
    }
    if (streams[0]) {
      for (const t of streams[0].getTracks()) {
        if (!remote.getTracks().some((x) => x.id === t.id)) remote.addTrack(t);
      }
    }
    if (!remote.getTracks().some((t) => t.id === track.id)) {
      remote.addTrack(track);
    }
    if (video.srcObject !== remote) video.srcObject = remote;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    void tryPlayWithSound(video);
    setStatus("live");
    setHint("");
  }

  async function tryPlayWithSound(video: HTMLVideoElement) {
    // Prefer live sound immediately; only fall back to muted if the browser blocks it.
    video.muted = false;
    needSoundRef.current = false;
    try {
      await video.play();
      setNeedSound(false);
    } catch {
      video.muted = true;
      needSoundRef.current = true;
      setNeedSound(true);
      await video.play().catch(() => {});
    }
  }

  function enableSound() {
    const video = videoRef.current;
    if (!video) return;
    void tryPlayWithSound(video);
  }

  function bumpStream() {
    setGuestStreamTick((n) => n + 1);
  }

  async function toggleGuestMic() {
    if (mediaBusy) return;
    if (guestMicOnRef.current) {
      const stream = guestStreamRef.current;
      stream?.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
      guestMicOnRef.current = false;
      setGuestMicOn(false);
      bumpStream();
      return;
    }
    setMediaBusy(true);
    try {
      let stream = guestStreamRef.current;
      let track = stream?.getAudioTracks().find((t) => t.readyState === "live");
      if (!track) {
        const mic = await openLiveMic();
        if (!mic) return;
        track = mic.getAudioTracks()[0];
        if (!track) return;
        if (!stream) {
          stream = new MediaStream();
          guestStreamRef.current = stream;
        }
        stream.addTrack(track);
        if (audioSenderRef.current) {
          await audioSenderRef.current.replaceTrack(track);
        }
      } else {
        track.enabled = true;
      }
      guestMicOnRef.current = true;
      setGuestMicOn(true);
      bumpStream();
    } finally {
      setMediaBusy(false);
    }
  }

  async function toggleGuestCam() {
    if (mediaBusy) return;
    if (guestCamOnRef.current) {
      await stopGuestCam();
      return;
    }
    setMediaBusy(true);
    try {
      let stream = guestStreamRef.current;
      let track = stream?.getVideoTracks().find((t) => t.readyState === "live");
      if (!track) {
        const cam = await openLiveVideo("user");
        if (!cam) return;
        track = cam.getVideoTracks()[0];
        if (!track) return;
        if (!stream) {
          stream = new MediaStream();
          guestStreamRef.current = stream;
        }
        stream.addTrack(track);
        if (videoSenderRef.current) {
          await videoSenderRef.current.replaceTrack(track);
        }
      } else {
        track.enabled = true;
      }
      guestCamOnRef.current = true;
      setGuestCamOn(true);
      setCamPreview(true);
      bumpStream();
    } finally {
      setMediaBusy(false);
    }
  }

  async function stopGuestCam() {
    const stream = guestStreamRef.current;
    const tracks = stream?.getVideoTracks() ?? [];
    for (const t of tracks) {
      t.stop();
      stream?.removeTrack(t);
    }
    if (videoSenderRef.current) {
      try {
        await videoSenderRef.current.replaceTrack(null);
      } catch {
        /* ignore */
      }
    }
    guestCamOnRef.current = false;
    setGuestCamOn(false);
    setCamPreview(false);
    bumpStream();
  }

  function confirmCamPreview() {
    setCamPreview(false);
  }

  useEffect(() => {
    if (!user) {
      router.push(`/login?next=/live/${initial.id}`);
      return;
    }
    if (initial.status !== "live") return;
    if (initial.hostId === user.id) {
      router.replace("/live/go");
      return;
    }

    let stop = false;
    const peer = `viewer:${user.id}`;
    const hostPeer = `host:${initial.hostId}`;
    const pc = new RTCPeerConnection(LIVE_ICE);
    pcRef.current = pc;
    seenRef.current = new Set();
    remoteStreamRef.current = new MediaStream();

    try {
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });
    } catch {
      /* older browsers */
    }

    pc.ontrack = (e) => {
      attachRemote(e.track, e.streams);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setStatus("live");
        setHint("");
      } else if (pc.connectionState === "failed") {
        setHint("Reconnecting…");
        pc.restartIce();
      }
    };

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      void postSignal(peer, hostPeer, "ice", { candidate: e.candidate.toJSON() });
    };

    async function postSignal(fromPeer: string, toPeer: string, kind: string, payload: unknown) {
      await fetch(`/api/live/${initial.id}/signal`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromPeer, toPeer, kind, payload }),
      });
    }

    async function join() {
      setHint("Joining…");
      await fetch(`/api/live/${initial.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      });
      await postSignal(peer, hostPeer, "join", {});
      setHint("Waiting for host…");
    }

    async function handleSignal(sig: { id: string; kind: string; payload: unknown }) {
      if (seenRef.current.has(sig.id)) return;
      seenRef.current.add(sig.id);

      if (sig.kind === "offer") {
        const desc = asSessionDescription(sig.payload) || asSessionDescription((sig.payload as { sdp?: unknown })?.sdp);
        if (!desc) return;
        await pc.setRemoteDescription(desc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await postSignal(peer, hostPeer, "answer", { sdp: sdpPayload(answer) });
      }

      if (sig.kind === "ice") {
        const cand = asIceCandidate(sig.payload) || asIceCandidate((sig.payload as { candidate?: unknown })?.candidate);
        if (!cand) return;
        try {
          await pc.addIceCandidate(cand);
        } catch {
          /* ignore */
        }
      }
    }

    async function poll() {
      while (!stop) {
        try {
          const res = await fetch(`/api/live/${initial.id}/signal?peer=${encodeURIComponent(peer)}`, {
            credentials: "include",
            cache: "no-store",
          });
          const data = await res.json().catch(() => ({}));
          if (typeof data.viewerCount === "number") {
            setSession((s) => ({ ...s, viewerCount: data.viewerCount }));
          }
          if (data.status === "ended") {
            setStatus("ended");
            break;
          }
          for (const sig of data.signals ?? []) {
            try {
              await handleSignal(sig);
            } catch {
              /* keep polling */
            }
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    void join()
      .then(() => poll())
      .catch(() => {
        setError("Could not join this live.");
        setStatus("error");
      });

    return () => {
      stop = true;
      void postSignal(peer, hostPeer, "leave", {});
      void fetch(`/api/live/${initial.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      });
      pc.close();
      pcRef.current = null;
      guestPcRef.current?.close();
      guestPcRef.current = null;
      guestStreamRef.current?.getTracks().forEach((t) => t.stop());
      guestStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, initial.id, initial.hostId, initial.status, router]);

  // When accepted as guest: join stage as profile first — mic/cam only when tapped.
  useEffect(() => {
    if (!user || guestStatus !== "accepted") return;
    let stop = false;
    const guestPeer = `guest:${user.id}`;
    const hostPeer = `host:${initial.hostId}`;

    guestMicOnRef.current = false;
    guestCamOnRef.current = false;
    setGuestMicOn(false);
    setGuestCamOn(false);
    setCamPreview(false);
    setGuestMode(true);
    guestStreamRef.current = new MediaStream();
    bumpStream();

    async function startGuestPc() {
      const pc = new RTCPeerConnection(LIVE_ICE);
      guestPcRef.current = pc;
      guestSeenRef.current = new Set();

      const audioTrans = pc.addTransceiver("audio", { direction: "sendonly" });
      const videoTrans = pc.addTransceiver("video", { direction: "sendonly" });
      audioSenderRef.current = audioTrans.sender;
      videoSenderRef.current = videoTrans.sender;

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        void fetch(`/api/live/${initial.id}/signal`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromPeer: guestPeer,
            toPeer: hostPeer,
            kind: "ice",
            payload: { candidate: e.candidate.toJSON() },
          }),
        });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await fetch(`/api/live/${initial.id}/signal`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromPeer: guestPeer,
          toPeer: hostPeer,
          kind: "offer",
          payload: { sdp: sdpPayload(offer), role: "guest" },
        }),
      });

      while (!stop) {
        try {
          const res = await fetch(`/api/live/${initial.id}/signal?peer=${encodeURIComponent(guestPeer)}`, {
            credentials: "include",
            cache: "no-store",
          });
          const data = await res.json().catch(() => ({}));
          for (const sig of data.signals ?? []) {
            if (guestSeenRef.current.has(sig.id)) continue;
            guestSeenRef.current.add(sig.id);
            if (sig.kind === "answer") {
              const desc = asSessionDescription(sig.payload) || asSessionDescription(sig.payload?.sdp);
              if (desc) await pc.setRemoteDescription(desc);
            }
            if (sig.kind === "ice") {
              const cand = asIceCandidate(sig.payload) || asIceCandidate(sig.payload?.candidate);
              if (cand) {
                try {
                  await pc.addIceCandidate(cand);
                } catch {
                  /* ignore */
                }
              }
            }
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    void startGuestPc();
    return () => {
      stop = true;
      guestPcRef.current?.close();
      guestPcRef.current = null;
      audioSenderRef.current = null;
      videoSenderRef.current = null;
      guestStreamRef.current?.getTracks().forEach((t) => t.stop());
      guestStreamRef.current = null;
      setGuestMode(false);
      setCamPreview(false);
    };
  }, [guestStatus, user, initial.id, initial.hostId]);

  // Tear down guest publish only when the live ends or guest seat is lost.
  useEffect(() => {
    if (guestStatus === "accepted" && status !== "ended") return;
    if (!guestStreamRef.current && !guestPcRef.current) return;
    guestPcRef.current?.close();
    guestPcRef.current = null;
    guestStreamRef.current?.getTracks().forEach((t) => t.stop());
    guestStreamRef.current = null;
    setGuestMode(false);
    setCamPreview(false);
  }, [status, guestStatus]);

  useEffect(() => {
    if (!guestMode) return;
    const stream = guestStreamRef.current;
    if (!stream) return;

    const attach = (el: HTMLVideoElement | null) => {
      if (!el) return;
      if (el.srcObject !== stream) {
        el.srcObject = stream;
        fitLiveVideo(el, true);
      }
      void el.play().catch(() => {});
    };

    attach(selfRef.current);
    if (camPreview) attach(previewRef.current);

    // Re-attach shortly after layout switches (big ↔ PiP) when the video node remounts.
    const t = window.setTimeout(() => {
      attach(selfRef.current);
      if (camPreview) attach(previewRef.current);
    }, 50);
    return () => window.clearTimeout(t);
  }, [guestMode, camPreview, guestCamOn, guestStreamTick, spotlightPeer]);

  const myGuestPeer = user ? `guest:${user.id}` : "";
  const imFeatured = !!(guestMode && spotlightPeer && spotlightPeer === myGuestPeer);

  function renderGuestSelf(featured?: boolean) {
    return (
      <div
        className={
          featured
            ? "relative h-full w-full bg-black"
            : "relative w-[8.25rem] overflow-hidden rounded-2xl border-2 border-white/55 bg-[#1a1a1a] shadow-xl"
        }
      >
        {guestCamOn ? (
          <video
            ref={selfRef}
            playsInline
            muted
            autoPlay
            className={`scale-x-[-1] object-cover ${featured ? "h-full w-full" : "h-[11rem] w-full"}`}
          />
        ) : (
          <div
            className={`grid place-items-center bg-gradient-to-b from-[#2a2a2a] to-[#141414] ${
              featured ? "h-full w-full" : "h-[11rem] w-full"
            }`}
          >
            <SpeakingWave stream={guestMicOn ? guestStreamRef.current : null} active={guestMicOn} variant="ring">
              <Avatar
                name={user?.name || "You"}
                hue={user?.avatarHue ?? 28}
                src={user?.avatarUrl}
                size={featured ? 88 : 56}
                userId={user?.id}
                showLive={false}
              />
            </SpeakingWave>
          </div>
        )}
        {guestCamOn ? (
          <SpeakingWave
            stream={guestMicOn ? guestStreamRef.current : null}
            active={guestMicOn}
            className="pointer-events-none absolute inset-0"
            variant="box"
          >
            <span className="sr-only">speaking</span>
          </SpeakingWave>
        ) : null}
        {!featured ? (
          <>
            <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold">You</span>
            <div className="pointer-events-auto absolute inset-x-0 bottom-7 z-10 flex justify-center gap-1.5" data-no-like>
              <button
                type="button"
                disabled={mediaBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleGuestMic();
                }}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/65"
                aria-label={guestMicOn ? "Mute" : "Unmute"}
              >
                {guestMicOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                disabled={mediaBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleGuestCam();
                }}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/65"
                aria-label={guestCamOn ? "Camera off" : "Camera on"}
              >
                {guestCamOn ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
              </button>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-black text-white">
      <video
        ref={videoRef}
        playsInline
        autoPlay
        className={`absolute bg-black object-cover transition-all duration-300 ${
          imFeatured
            ? "bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-3 z-[6] h-[7.25rem] w-[5.5rem] rounded-2xl border-2 border-white/45"
            : "inset-0 z-0 h-full w-full"
        }`}
      />

      {guestMode && camPreview && guestCamOn ? (
        <div className="absolute inset-0 z-[30] flex flex-col bg-black">
          <video ref={previewRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full scale-x-[-1] object-cover" />
          <button
            type="button"
            onClick={() => void stopGuestCam()}
            className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/50"
            aria-label="Close"
          >
            <span className="text-lg leading-none">×</span>
          </button>
          <div className="absolute inset-x-0 bottom-0 z-10 flex gap-2 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => void stopGuestCam()}
              className="h-12 flex-1 rounded-full bg-white/15 text-[15px] font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmCamPreview}
              className="h-12 flex-1 rounded-full bg-[#e85d04] text-[15px] font-semibold"
            >
              Show
            </button>
          </div>
        </div>
      ) : null}

      {/* Featured = same chrome; only the stage layers swap under it */}
      {guestMode && imFeatured && !camPreview ? (
        <div className="pointer-events-none absolute inset-0 z-0">{renderGuestSelf(true)}</div>
      ) : null}

      {guestMode && !imFeatured && !(camPreview && guestCamOn) ? (
        <div className="absolute right-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[25]" data-no-like>
          {renderGuestSelf(false)}
        </div>
      ) : null}

      {status !== "ended" ? (
        <LiveStageChrome
          sessionId={initial.id}
          session={session}
          me={user}
          role="viewer"
          onClose={() => router.push("/messages")}
          onGuestStatus={setGuestStatus}
          onSpotlightPeer={setSpotlightPeer}
          onInteract={enableSound}
          hostControls={
            guestMode ? (
              <div className="flex items-center gap-1" data-no-like>
                <button
                  type="button"
                  disabled={mediaBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleGuestMic();
                  }}
                  className="grid h-9 w-9 place-items-center rounded-full bg-black/40 backdrop-blur-md"
                  aria-label={guestMicOn ? "Mute" : "Unmute"}
                >
                  {guestMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  disabled={mediaBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleGuestCam();
                  }}
                  className="grid h-9 w-9 place-items-center rounded-full bg-black/40 backdrop-blur-md"
                  aria-label={guestCamOn ? "Camera off" : "Camera on"}
                >
                  {guestCamOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </button>
              </div>
            ) : undefined
          }
        />
      ) : null}

      {needSound && status === "live" ? (
        <button
          type="button"
          onClick={enableSound}
          className="absolute top-[28%] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-4 py-2.5 text-sm font-semibold backdrop-blur-md"
        >
          <VolumeX className="h-4 w-4" />
          Tap for sound
          <Volume2 className="h-4 w-4" />
        </button>
      ) : null}

      {status === "connecting" ? (
        <p className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/35 px-6 text-center text-sm text-white/90">
          {hint || "Connecting to live…"}
        </p>
      ) : null}
      {status === "ended" ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/75 px-8 text-center">
          <div>
            <p className="text-lg font-semibold">This live ended</p>
            <button
              type="button"
              onClick={() => router.push("/messages")}
              className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
            >
              Back home
            </button>
          </div>
        </div>
      ) : null}
      {status === "error" ? <p className="absolute inset-x-0 bottom-28 z-20 text-center text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
