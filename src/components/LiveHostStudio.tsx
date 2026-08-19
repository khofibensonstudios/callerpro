"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Radio, SwitchCamera, Video, VideoOff, X } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { LiveStageChrome } from "./LiveStageChrome";
import { LiveEndSheet } from "./LiveEndSheet";
import { LiveGuestStage } from "./LiveGuestStage";
import { fitLiveVideo, openLiveCamera } from "@/lib/live-camera";
import type { LiveSession } from "@/lib/live";
import { LIVE_SPOTLIGHT_GUEST_LIMIT } from "@/lib/live-shared";
import type { LiveSummary } from "@/lib/live-shared";
import { LIVE_ICE, asIceCandidate, asSessionDescription, sdpPayload } from "@/lib/live-webrtc";

type CamState = "starting" | "ready" | "ask" | "denied";
type GuestProfile = { name: string; avatarHue: number; avatarUrl?: string };

export function LiveHostStudio() {
  const router = useRouter();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const guestStreams = useRef<Map<string, MediaStream>>(new Map());
  const seenSignals = useRef<Set<string>>(new Set());
  const sessionId = useRef("");
  const [title, setTitle] = useState("");
  const [live, setLive] = useState(false);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [cam, setCam] = useState<CamState>("starting");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [summary, setSummary] = useState<LiveSummary | null>(null);
  const [guestBoxes, setGuestBoxes] = useState<Array<{ peer: string; muted: boolean; userId: string }>>([]);
  const [guestProfiles, setGuestProfiles] = useState<Record<string, GuestProfile>>({});
  const [spotlightPeer, setSpotlightPeer] = useState<string | null>(null);
  const startingRef = useRef(false);
  const liveRef = useRef(false);

  async function openCamera(face: "user" | "environment", fromTap = false) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCam("ask");
      return null;
    }
    // Don't flash a full-screen “Opening camera…” wall — keep the Live UI up.
    if (!fromTap && cam !== "ready") setCam((c) => (c === "ready" ? c : "starting"));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await openLiveCamera(face);
      if (!stream) throw new DOMException("Failed", "NotFoundError");
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("webkit-playsinline", "true");
        const applyFit = () => fitLiveVideo(videoRef.current, face === "user");
        videoRef.current.onloadedmetadata = applyFit;
        applyFit();
        await videoRef.current.play().catch(() => {});
      }
      setCam("ready");
      setError("");
      setMuted(false);
      setCamOff(false);
      return stream;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") setCam("denied");
      else setCam("ask");
      return null;
    }
  }

  useEffect(() => {
    void openCamera(facing);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      peers.current.forEach((pc) => pc.close());
      peers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If host still has an active live (e.g. closed the tab by mistake), continue it.
  // End live is a full kill — after End, this finds nothing and shows a fresh go-live screen.
  useEffect(() => {
    if (!user || liveRef.current) return;
    let stop = false;
    async function resume() {
      try {
        const res = await fetch("/api/live?mine=1", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (stop || !data.session || data.session.status !== "live") return;
        sessionId.current = data.session.id;
        seenSignals.current = new Set();
        liveRef.current = true;
        setTitle(data.session.title || "");
        setSession(data.session);
        setLive(true);
      } catch {
        /* ignore */
      }
    }
    void resume();
    return () => {
      stop = true;
    };
  }, [user]);

  // Heartbeat while live. Keep pinging even if the host switches apps —
  // only end the live when pings truly stop (no internet), not on brief backgrounding.
  useEffect(() => {
    if (!live || !user) return;
    let stop = false;
    function beat(forceBeacon = false) {
      if (stop || !sessionId.current) return;
      const url = `/api/live/${sessionId.current}`;
      const body = JSON.stringify({ action: "heartbeat" });
      const useBeacon = forceBeacon || document.visibilityState === "hidden";
      if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        try {
          const blob = new Blob([body], { type: "application/json" });
          if (navigator.sendBeacon(url, blob)) return;
        } catch {
          /* fall through */
        }
      }
      void fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {
        /* offline — server expires after ~5 minutes without a beat */
      });
    }
    beat();
    const id = window.setInterval(() => beat(), 8_000);
    const onVis = () => {
      beat(document.visibilityState === "hidden");
    };
    const onHide = () => beat(true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("freeze", onHide);
    return () => {
      stop = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("freeze", onHide);
    };
  }, [live, user]);

  // Warn if closing the tab while live (session stays live until End / heartbeat timeout).
  useEffect(() => {
    if (!live) return;
    function onLeave(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [live]);

  async function sendSignal(toPeer: string, kind: string, payload: unknown) {
    if (!user || !sessionId.current) return;
    await fetch(`/api/live/${sessionId.current}/signal`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromPeer: `host:${user.id}`,
        toPeer,
        kind,
        payload,
      }),
    });
  }

  async function ensurePeer(viewerPeer: string) {
    if (!user) throw new Error("No user");
    // Guest peers use a different path (they send an offer to the host).
    if (viewerPeer.startsWith("guest:")) return null;
    const existing = peers.current.get(viewerPeer);
    if (existing) {
      existing.close();
      peers.current.delete(viewerPeer);
    }
    const stream = streamRef.current;
    if (!stream) throw new Error("No camera");
    // Ensure mic tracks are live for viewers.
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
    const pc = new RTCPeerConnection(LIVE_ICE);
    peers.current.set(viewerPeer, pc);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.onicecandidate = (e) => {
      if (e.candidate) void sendSignal(viewerPeer, "ice", { candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        pc.close();
        peers.current.delete(viewerPeer);
      }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal(viewerPeer, "offer", { sdp: sdpPayload(offer) });
    return pc;
  }

  async function acceptGuestOffer(guestPeer: string, payload: unknown) {
    if (!user) return;
    const desc = asSessionDescription(payload) || asSessionDescription((payload as { sdp?: unknown })?.sdp);
    if (!desc) return;
    const existing = peers.current.get(guestPeer);
    if (existing) {
      existing.close();
      peers.current.delete(guestPeer);
    }
    const pc = new RTCPeerConnection(LIVE_ICE);
    peers.current.set(guestPeer, pc);
    const remote = new MediaStream();
    guestStreams.current.set(guestPeer, remote);
    const userId = guestPeer.replace(/^guest:/, "");
    setGuestBoxes((prev) => {
      const rest = prev.filter((g) => g.peer !== guestPeer);
      return [...rest, { peer: guestPeer, muted: false, userId }];
    });

    pc.ontrack = (e) => {
      if (!remote.getTracks().some((t) => t.id === e.track.id)) remote.addTrack(e.track);
      const bump = () =>
        setGuestBoxes((prev) => prev.map((g) => (g.peer === guestPeer ? { ...g } : g)));
      e.track.addEventListener("mute", bump);
      e.track.addEventListener("unmute", bump);
      e.track.addEventListener("ended", bump);
      const el = document.getElementById(`guest-video-${guestPeer}`) as HTMLVideoElement | null;
      if (el && el.srcObject !== remote) {
        el.srcObject = remote;
        void el.play().catch(() => {});
      }
      bump();
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) void sendSignal(guestPeer, "ice", { candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        pc.close();
        peers.current.delete(guestPeer);
        guestStreams.current.delete(guestPeer);
        setGuestBoxes((prev) => prev.filter((g) => g.peer !== guestPeer));
      }
    };

    await pc.setRemoteDescription(desc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendSignal(guestPeer, "answer", { sdp: sdpPayload(answer) });
  }

  function toggleGuestMute(peer: string) {
    const stream = guestStreams.current.get(peer);
    if (!stream) return;
    setGuestBoxes((prev) =>
      prev.map((g) => {
        if (g.peer !== peer) return g;
        const next = !g.muted;
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !next;
        });
        return { ...g, muted: next };
      }),
    );
  }

  async function removeGuest(peer: string, userId: string) {
    if (!sessionId.current) return;
    await fetch(`/api/live/${sessionId.current}/guests`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, status: "rejected" }),
    });
    const pc = peers.current.get(peer);
    pc?.close();
    peers.current.delete(peer);
    guestStreams.current.delete(peer);
    setGuestBoxes((prev) => prev.filter((g) => g.peer !== peer));
    void sendSignal(peer, "leave", {});
  }

  useEffect(() => {
    if (!live || !user) return;
    let stop = false;
    async function poll() {
      while (!stop) {
        try {
          if (!sessionId.current) {
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          const q = new URLSearchParams({ peer: `host:${user!.id}` });
          const res = await fetch(`/api/live/${sessionId.current}/signal?${q}`, {
            credentials: "include",
            cache: "no-store",
          });
          if (!res.ok) {
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }
          const data = await res.json();
          if (typeof data.viewerCount === "number") {
            setSession((s) => (s ? { ...s, viewerCount: data.viewerCount } : s));
          }
          if (data.status === "ended" && liveRef.current) {
            liveRef.current = false;
            setLive(false);
            break;
          }
          for (const sig of data.signals ?? []) {
            if (seenSignals.current.has(sig.id)) continue;
            seenSignals.current.add(sig.id);
            const from = String(sig.fromPeer || "");

            if (sig.kind === "join" && from.startsWith("viewer:")) {
              try {
                await ensurePeer(from);
              } catch {
                /* camera may still be starting */
              }
              continue;
            }

            if (sig.kind === "offer" && from.startsWith("guest:")) {
              try {
                await acceptGuestOffer(from, sig.payload);
              } catch {
                /* ignore */
              }
              continue;
            }

            const pc = peers.current.get(from);
            if (!pc) continue;
            if (sig.kind === "answer") {
              const desc = asSessionDescription(sig.payload) || asSessionDescription(sig.payload?.sdp);
              if (desc && (pc.signalingState !== "stable" || !pc.currentRemoteDescription)) {
                await pc.setRemoteDescription(desc);
              }
            }
            if (sig.kind === "ice") {
              const cand = asIceCandidate(sig.payload) || asIceCandidate(sig.payload?.candidate);
              if (!cand) continue;
              try {
                await pc.addIceCandidate(cand);
              } catch {
                /* ignore */
              }
            }
            if (sig.kind === "leave") {
              pc.close();
              peers.current.delete(from);
              if (from.startsWith("guest:")) {
                guestStreams.current.delete(from);
                setGuestBoxes((prev) => prev.filter((g) => g.peer !== from));
              }
            }
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    void poll();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, user]);

  async function goLive() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (startingRef.current || liveRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setError("");
    let stream = streamRef.current;
    if (!stream) stream = await openCamera(facing, true);
    if (!stream) {
      startingRef.current = false;
      setStarting(false);
      return;
    }
    const liveTitle = title.trim() || `${user.name}'s live`;
    const res = await fetch("/api/live", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: liveTitle }),
    });
    const data = await res.json();
    startingRef.current = false;
    setStarting(false);
    if (!res.ok) {
      setError(data.error || "Could not start live.");
      return;
    }
    sessionId.current = data.session.id;
    seenSignals.current = new Set();
    liveRef.current = true;
    setSession({
      ...data.session,
      title: liveTitle,
      host: data.session.host || {
        id: user.id,
        name: user.name,
        headline: user.headline,
        avatarHue: user.avatarHue,
        avatarUrl: user.avatarUrl,
        bio: "",
        skills: [],
        formats: [],
        balanceMicros: 0,
        lifetimeMicros: 0,
        onboarded: user.onboarded,
        createdAt: new Date().toISOString(),
      },
    });
    setLive(true);
    // Stay on /live/go — do not rewrite URL to /live/[id] (that remounts and kills the stream).
  }

  async function endLive() {
    liveRef.current = false;
    let nextSummary: LiveSummary | null = null;
    if (sessionId.current) {
      const res = await fetch(`/api/live/${sessionId.current}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.summary) nextSummary = data.summary as LiveSummary;
    }
    peers.current.forEach((pc) => pc.close());
    peers.current.clear();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
    if (nextSummary) {
      setSummary(nextSummary);
      return;
    }
    router.push("/messages");
  }

  function toggleMute() {
    if (!streamRef.current) {
      void openCamera(facing, true);
      return;
    }
    const next = !muted;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  }

  function toggleCam() {
    if (!streamRef.current) {
      void openCamera(facing, true);
      return;
    }
    const next = !camOff;
    streamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
    setCamOff(next);
  }

  async function flip() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    const stream = await openCamera(next, true);
    if (!stream) return;
    peers.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      const track = stream.getVideoTracks()[0];
      if (sender && track) void sender.replaceTrack(track);
    });
  }

  // Load guest profiles (name / avatar) for the boxes.
  useEffect(() => {
    if (!live || !sessionId.current) return;
    let stop = false;
    async function load() {
      try {
        const res = await fetch(`/api/live/${sessionId.current}/guests`, { credentials: "include", cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (stop) return;
        const next: Record<string, GuestProfile> = {};
        const accepted: Array<{ peer: string; muted: boolean; userId: string }> = [];
        for (const g of data.guests || []) {
          if (g.userId && g.user) {
            next[g.userId] = {
              name: g.user.name,
              avatarHue: g.user.avatarHue ?? 28,
              avatarUrl: g.user.avatarUrl,
            };
          }
          if (g.status === "accepted" && g.userId) {
            accepted.push({ peer: `guest:${g.userId}`, muted: false, userId: g.userId });
          }
        }
        setGuestProfiles(next);
        setGuestBoxes((prev) => {
          const muteMap = new Map(prev.map((p) => [p.userId, p.muted]));
          return accepted.map((a) => ({
            ...a,
            muted: muteMap.get(a.userId) ?? false,
          }));
        });
        if ("spotlightPeer" in data) {
          setSpotlightPeer(data.spotlightPeer ?? null);
        }
      } catch {
        /* ignore */
      }
    }
    void load();
    const t = window.setInterval(() => void load(), 3000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [live]);

  useEffect(() => {
    if (guestBoxes.length > LIVE_SPOTLIGHT_GUEST_LIMIT) {
      if (spotlightPeer) {
        setSpotlightPeer(null);
        void syncSpotlight(null);
      }
      return;
    }
    if (spotlightPeer && !guestBoxes.some((g) => g.peer === spotlightPeer)) {
      setSpotlightPeer(null);
      void syncSpotlight(null);
    }
  }, [guestBoxes, spotlightPeer]);

  async function syncSpotlight(peer: string | null) {
    if (!sessionId.current) return;
    try {
      await fetch(`/api/live/${sessionId.current}/guests`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotlightPeer: peer }),
      });
    } catch {
      /* ignore */
    }
  }

  function handleSpotlight(peer: string | null) {
    setSpotlightPeer(peer);
    void syncSpotlight(peer);
  }

  const needPermission = cam === "ask" || cam === "denied";
  const hostSwapped = !!(spotlightPeer && guestBoxes.some((g) => g.peer === spotlightPeer) && guestBoxes.length <= LIVE_SPOTLIGHT_GUEST_LIMIT);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute bg-black object-cover transition-all duration-300 ${
          hostSwapped ? "pointer-events-none opacity-0" : "inset-0 h-full w-full"
        }`}
      />

      {live && session ? (
        <LiveStageChrome
          sessionId={session.id}
          session={session}
          me={user}
          role="host"
          onClose={() => void endLive()}
          onEnd={() => void endLive()}
          guestTiles={
            guestBoxes.length ? (
              <LiveGuestStage
                guestBoxes={guestBoxes}
                guestStreams={guestStreams.current}
                guestProfiles={guestProfiles}
                spotlightPeer={spotlightPeer}
                onSpotlight={handleSpotlight}
                onMute={toggleGuestMute}
                onRemove={(peer, userId) => void removeGuest(peer, userId)}
                hostStream={hostSwapped ? streamRef.current : null}
                hostName={user?.name || "Host"}
              />
            ) : null
          }
          hostControls={
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                className="grid h-9 w-9 place-items-center rounded-full bg-black/40 backdrop-blur-md"
                aria-label="Mic"
              >
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCam();
                }}
                className="grid h-9 w-9 place-items-center rounded-full bg-black/40 backdrop-blur-md"
                aria-label="Camera"
              >
                {camOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void flip();
                }}
                className="grid h-9 w-9 place-items-center rounded-full bg-black/40 backdrop-blur-md"
                aria-label="Flip"
              >
                <SwitchCamera className="h-4 w-4" />
              </button>
            </>
          }
        />
      ) : null}

      {summary ? <LiveEndSheet onDone={() => router.push("/messages")} /> : null}

      {!live ? (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/75" />

          <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] inset-x-0 z-10 flex items-center justify-between px-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="grid h-10 w-10 place-items-center rounded-full bg-black/35 backdrop-blur-md"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="text-[15px] font-semibold tracking-tight">Live</p>
            <button
              type="button"
              onClick={() => void flip()}
              className="grid h-10 w-10 place-items-center rounded-full bg-black/35 backdrop-blur-md"
              aria-label="Flip camera"
            >
              <SwitchCamera className="h-5 w-5" />
            </button>
          </div>
        </>
      ) : null}

      {needPermission && !live ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 px-8 text-center">
          <div className="mb-6 grid h-20 w-20 place-items-center rounded-full bg-white/10">
            <Video className="h-9 w-9" />
          </div>
          <p className="text-[17px] font-semibold">Turn on camera</p>
          <p className="mt-2 max-w-xs text-sm text-white/65">
            {cam === "denied" ? "Allow camera on the next popup." : "Allow camera and mic when asked."}
          </p>
          <button
            type="button"
            onClick={() => void openCamera(facing, true)}
            className="mt-6 h-12 rounded-full bg-red-600 px-8 text-[16px] font-semibold"
          >
            Continue
          </button>
        </div>
      ) : null}

      {!live && !needPermission ? (
        <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-[max(1.35rem,env(safe-area-inset-bottom))]">
          <div className="mb-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a title"
              maxLength={80}
              className="w-full bg-transparent text-[28px] font-semibold leading-tight tracking-tight outline-none placeholder:text-white/40"
            />
          </div>

          {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}

          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={toggleMute}
              className="grid h-12 w-12 place-items-center rounded-full bg-white/12 backdrop-blur-md"
              aria-label="Mic"
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={toggleCam}
              className="grid h-12 w-12 place-items-center rounded-full bg-white/12 backdrop-blur-md"
              aria-label="Camera"
            >
              {camOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </button>
          </div>

          <button
            type="button"
            disabled={starting || cam !== "ready"}
            onClick={() => void goLive()}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-red-600 text-[17px] font-semibold shadow-[0_8px_28px_rgba(220,38,38,0.35)] disabled:opacity-50"
          >
            <Radio className="h-5 w-5" />
            {starting ? "Going live…" : cam !== "ready" ? "Getting ready…" : "Go Live"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
