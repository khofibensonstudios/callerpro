"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  SwitchCamera,
  UserPlus,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { LIVE_ICE, asIceCandidate, asSessionDescription, sdpPayload } from "@/lib/live-webrtc";
import { fitLiveVideo, openLiveCamera, openLiveMic } from "@/lib/live-camera";

type Person = { id: string; name: string; avatarHue: number; avatarUrl?: string };
type CallRole = "caller" | "callee";
type CallMode = "audio" | "video";
type UiStatus = "ringing-out" | "ringing-in" | "connecting" | "connected";

type SignalRow = {
  id: string;
  fromId?: string;
  kind: string;
  payload: unknown;
  createdAt: string;
};

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceCallOverlay({
  threadId,
  meId,
  other,
  initialRole,
  initialIncoming,
  initialMode = "audio",
  onClose,
}: {
  threadId: string;
  meId: string;
  other: Person;
  initialRole: CallRole;
  initialIncoming?: boolean;
  initialMode?: CallMode;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<UiStatus>(
    initialIncoming ? "ringing-in" : initialRole === "caller" ? "ringing-out" : "ringing-in",
  );
  const [mode, setMode] = useState<CallMode>(initialMode);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(initialMode === "video");
  const [hint, setHint] = useState("");
  const [people, setPeople] = useState<Person[]>([other]);
  const [remoteKeys, setRemoteKeys] = useState<string[]>([]);
  const [picker, setPicker] = useState<Person[] | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [elapsed, setElapsed] = useState(0);

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const afterRef = useRef<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const offeringRef = useRef<Set<string>>(new Set());
  const micMutedRef = useRef(false);
  const camOffRef = useRef(false);
  const modeRef = useRef<CallMode>(initialMode);
  const endedRef = useRef(false);
  const joinedRef = useRef(!initialIncoming);
  const misses = useRef(0);
  const connectedAtRef = useRef<number | null>(null);
  const pollLock = useRef(false);
  const facingRef = useRef<"user" | "environment">("user");
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { micMutedRef.current = micMuted; }, [micMuted]);
  useEffect(() => { camOffRef.current = camOff; }, [camOff]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { facingRef.current = facing; }, [facing]);

  // Call duration timer
  useEffect(() => {
    if (status !== "connected") return;
    if (!connectedAtRef.current) connectedAtRef.current = Date.now();
    const t = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - connectedAtRef.current!) / 1000));
    }, 1000);
    return () => window.clearInterval(t);
  }, [status]);

  // Ringtone for incoming / ringing-out
  useEffect(() => {
    if (status !== "ringing-in" && status !== "ringing-out") {
      ringtoneRef.current?.pause();
      ringtoneRef.current = null;
      return;
    }
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = status === "ringing-in" ? 440 : 480;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);

      let on = true;
      const toggle = () => {
        if (endedRef.current) { ctx.close().catch(() => {}); return; }
        gain.gain.value = on ? 0.08 : 0;
        on = !on;
      };
      osc.start();
      const interval = window.setInterval(toggle, status === "ringing-in" ? 500 : 1500);

      return () => {
        window.clearInterval(interval);
        osc.stop();
        ctx.close().catch(() => {});
      };
    } catch {
      return;
    }
  }, [status]);

  // Vibrate on incoming
  useEffect(() => {
    if (status !== "ringing-in") return;
    const vibrate = () => { try { navigator.vibrate?.([400, 200, 400]); } catch {} };
    vibrate();
    const t = window.setInterval(vibrate, 2000);
    return () => { window.clearInterval(t); try { navigator.vibrate?.(0); } catch {} };
  }, [status]);

  const cleanup = useCallback(() => {
    endedRef.current = true;
    for (const pc of pcsRef.current.values()) pc.close();
    pcsRef.current.clear();
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    remoteStreamsRef.current.clear();
    for (const el of remoteAudiosRef.current.values()) {
      el.srcObject = null;
      el.remove();
    }
    remoteAudiosRef.current.clear();
    try { navigator.vibrate?.(0); } catch {}
  }, []);

  const hangup = useCallback(
    async (action: "hangup" | "reject" = "hangup") => {
      try {
        await fetch(`/api/inbox/${threadId}/call`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
      } catch {}
      cleanup();
      onClose();
    },
    [cleanup, onClose, threadId],
  );

  const postSignal = useCallback(
    async (kind: "sdp" | "ice", payload: unknown) => {
      await fetch(`/api/inbox/${threadId}/call`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signal", kind, payload }),
      });
    },
    [threadId],
  );

  const attachRemote = useCallback((peerId: string, stream: MediaStream) => {
    remoteStreamsRef.current.set(peerId, stream);
    setRemoteKeys((keys) => (keys.includes(peerId) ? keys : [...keys, peerId]));

    // Attach video element if present
    const video = remoteVideosRef.current.get(peerId);
    if (video) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    }

    // Per-peer audio element so group calls work
    if (stream.getAudioTracks().length) {
      let audio = remoteAudiosRef.current.get(peerId);
      if (!audio) {
        audio = document.createElement("audio");
        audio.autoplay = true;
        (audio as unknown as Record<string, boolean>).playsInline = true;
        document.body.appendChild(audio);
        remoteAudiosRef.current.set(peerId, audio);
      }
      audio.srcObject = stream;
      void audio.play().catch(() => setHint("Tap to hear"));
    }
    setStatus("connected");
  }, []);

  const ensureLocal = useCallback(async () => {
    if (localRef.current) return localRef.current;
    const stream =
      modeRef.current === "video"
        ? await openLiveCamera(facingRef.current)
        : await openLiveMic();
    if (!stream) throw new Error("Could not open camera or mic");
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !micMutedRef.current;
      try { t.contentHint = "speech"; } catch {}
    });
    stream.getVideoTracks().forEach((t) => {
      t.enabled = !camOffRef.current;
    });
    localRef.current = stream;
    if (localVideoRef.current && modeRef.current === "video") {
      localVideoRef.current.srcObject = stream;
      fitLiveVideo(localVideoRef.current, facingRef.current === "user");
      void localVideoRef.current.play().catch(() => {});
    }
    return stream;
  }, []);

  const ensurePc = useCallback(
    async (peerId: string) => {
      const existing = pcsRef.current.get(peerId);
      if (existing) return existing;
      const stream = await ensureLocal();
      const pc = new RTCPeerConnection(LIVE_ICE);
      pcsRef.current.set(peerId, pc);
      for (const track of stream.getTracks()) pc.addTrack(track, stream);

      pc.onicecandidate = (e) => {
        if (!e.candidate || endedRef.current) return;
        void postSignal("ice", { peerId, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        const s = e.streams[0] || new MediaStream([e.track]);
        attachRemote(peerId, s);
      };
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
          try { pc.restartIce(); } catch {}
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setStatus("connected");
        if (pc.connectionState === "disconnected") {
          try { pc.restartIce(); } catch {}
        }
        if (pc.connectionState === "failed") {
          try { pc.restartIce(); } catch { setHint("Connection failed"); }
        }
      };
      // Bitrate caps
      try {
        for (const sender of pc.getSenders()) {
          const params = sender.getParameters();
          if (!params.encodings?.length) params.encodings = [{}];
          if (sender.track?.kind === "audio") params.encodings[0].maxBitrate = 64_000;
          if (sender.track?.kind === "video") params.encodings[0].maxBitrate = 1_500_000;
          void sender.setParameters(params);
        }
      } catch {}
      return pc;
    },
    [attachRemote, ensureLocal, postSignal],
  );

  const createOffer = useCallback(
    async (peerId: string) => {
      if (offeringRef.current.has(peerId)) return;
      offeringRef.current.add(peerId);
      try {
        const pc = await ensurePc(peerId);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: modeRef.current === "video",
        });
        await pc.setLocalDescription(offer);
        await postSignal("sdp", { peerId, ...sdpPayload(pc.localDescription!) });
      } finally {
        offeringRef.current.delete(peerId);
      }
    },
    [ensurePc, postSignal],
  );

  const syncPeers = useCallback(
    async (ids: string[]) => {
      const others = ids.filter((id) => id !== meId);
      for (const peerId of others) {
        await ensurePc(peerId);
        if (meId > peerId && joinedRef.current) await createOffer(peerId);
      }
    },
    [createOffer, ensurePc, meId],
  );

  const handleSignal = useCallback(
    async (sig: SignalRow) => {
      if (seenRef.current.has(sig.id)) return;
      seenRef.current.add(sig.id);
      const fromId = sig.fromId || other.id;

      if (sig.kind === "accept") {
        setStatus("connecting");
        joinedRef.current = true;
        await syncPeers(people.map((p) => p.id).concat(meId));
        if (fromId && fromId !== meId) await createOffer(fromId);
        return;
      }
      if (sig.kind === "reject" || sig.kind === "hangup") {
        const left = (sig.payload as { left?: string } | null)?.left;
        if (left && left !== meId && pcsRef.current.size > 1) {
          pcsRef.current.get(left)?.close();
          pcsRef.current.delete(left);
          remoteStreamsRef.current.delete(left);
          const audioEl = remoteAudiosRef.current.get(left);
          if (audioEl) { audioEl.srcObject = null; audioEl.remove(); remoteAudiosRef.current.delete(left); }
          setRemoteKeys((keys) => keys.filter((k) => k !== left));
          setPeople((list) => list.filter((p) => p.id !== left));
          return;
        }
        cleanup();
        onClose();
        return;
      }
      if (sig.kind === "invite") {
        const nextMode = (sig.payload as { mode?: CallMode } | null)?.mode;
        if (nextMode) setMode(nextMode);
        if (!joinedRef.current) setStatus("ringing-in");
        return;
      }

      if (sig.kind === "sdp") {
        const raw = sig.payload as { type?: string; sdp?: string; peerId?: string } | null;
        const desc = asSessionDescription(raw);
        if (!desc) return;
        const peerId = fromId;
        const pc = await ensurePc(peerId);
        if (desc.type === "offer") {
          if (pc.signalingState !== "stable") {
            try { await pc.setLocalDescription({ type: "rollback" }); } catch {}
          }
          await pc.setRemoteDescription(desc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await postSignal("sdp", { peerId, ...sdpPayload(pc.localDescription!) });
          setStatus("connecting");
        } else if (desc.type === "answer") {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(desc);
          }
          setStatus("connected");
        }
        return;
      }

      if (sig.kind === "ice") {
        const raw = sig.payload as { candidate?: unknown; peerId?: string } | null;
        const cand = asIceCandidate(raw?.candidate ?? raw);
        const peerId = fromId;
        const pc = pcsRef.current.get(peerId);
        if (!cand || !pc) return;
        try { await pc.addIceCandidate(cand); } catch {}
      }
    },
    [cleanup, createOffer, ensurePc, meId, onClose, other.id, people, postSignal, syncPeers],
  );

  // Boot: caller sends invite
  useEffect(() => {
    let stop = false;
    async function boot() {
      if (initialIncoming) return;
      if (initialRole !== "caller") return;
      const res = await fetch(`/api/inbox/${threadId}/call`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invite", mode: initialMode }),
      });
      const data = await res.json().catch(() => ({}));
      if (stop) return;
      if (!res.ok) {
        setHint(data.error || "Could not start call");
        window.setTimeout(() => { cleanup(); onClose(); }, 1200);
        return;
      }
      if (initialMode === "video") {
        try { await ensureLocal(); } catch { setHint("Allow camera and mic"); }
      }
    }
    void boot();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for signals
  useEffect(() => {
    let stop = false;
    async function poll() {
      if (endedRef.current || stop || pollLock.current) return;
      pollLock.current = true;
      try {
        const q = afterRef.current ? `?after=${encodeURIComponent(afterRef.current)}` : "";
        const res = await fetch(`/api/inbox/${threadId}/call${q}`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (stop || endedRef.current) return;
        if (!data.call && status !== "ringing-out" && status !== "ringing-in") {
          misses.current += 1;
          if (misses.current < 4) return;
          cleanup(); onClose(); return;
        }
        misses.current = 0;
        if (data.call?.status === "ended") { cleanup(); onClose(); return; }
        if (data.call?.mode) setMode(data.call.mode);
        if (Array.isArray(data.people) && data.people.length) {
          setPeople(data.people.filter((p: Person) => p.id !== meId));
        }
        if (data.call?.status === "connected" && joinedRef.current) {
          await syncPeers(data.call.participantIds || []);
        }
        const list: SignalRow[] = data.signals || [];
        for (const sig of list) {
          afterRef.current = sig.createdAt;
          await handleSignal(sig);
        }
      } catch {} finally {
        pollLock.current = false;
      }
    }
    void poll();
    const t = window.setInterval(() => void poll(), 600);
    return () => { stop = true; window.clearInterval(t); };
  }, [cleanup, handleSignal, meId, onClose, status, syncPeers, threadId]);

  // Cleanup on unmount
  useEffect(() => { return () => cleanup(); }, [cleanup]);

  // Mic mute sync
  useEffect(() => {
    localRef.current?.getAudioTracks().forEach((t) => { t.enabled = !micMuted; });
  }, [micMuted]);

  // Camera toggle
  useEffect(() => {
    localRef.current?.getVideoTracks().forEach((t) => { t.enabled = !camOff; });
  }, [camOff]);

  async function acceptIncoming() {
    setStatus("connecting");
    const res = await fetch(`/api/inbox/${threadId}/call`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (!res.ok) { setHint("Could not answer"); return; }
    joinedRef.current = true;
    try {
      await ensureLocal();
      await syncPeers(people.map((p) => p.id).concat(meId));
    } catch { setHint("Allow camera and mic"); }
  }

  async function openPicker() {
    const res = await fetch("/api/inbox", { credentials: "include" });
    const d = await res.json().catch(() => ({}));
    const items = (d.items ?? []) as { other?: Person }[];
    const taken = new Set([meId, ...people.map((p) => p.id)]);
    const next: Person[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      const p = item.other;
      if (!p?.id || taken.has(p.id) || seen.has(p.id)) continue;
      seen.add(p.id);
      next.push(p);
    }
    setPicker(next);
  }

  async function addPerson(person: Person) {
    const res = await fetch(`/api/inbox/${threadId}/call`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", userId: person.id }),
    });
    if (res.ok) setPeople((list) => (list.some((p) => p.id === person.id) ? list : [...list, person]));
    setPicker(null);
  }

  async function flipCamera() {
    if (mode !== "video") return;
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    try {
      const stream = await openLiveCamera(next);
      if (!stream) return;
      const newTrack = stream.getVideoTracks()[0];
      localRef.current?.getVideoTracks().forEach((t) => t.stop());
      if (localRef.current && newTrack) {
        localRef.current.removeTrack(localRef.current.getVideoTracks()[0]);
        localRef.current.addTrack(newTrack);
        stream.getAudioTracks().forEach((t) => t.stop());
        for (const pc of pcsRef.current.values()) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) await sender.replaceTrack(newTrack);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localRef.current;
          fitLiveVideo(localVideoRef.current, next === "user");
        }
      }
    } catch {}
  }

  async function upgradeToVideo() {
    if (mode === "video") return;
    setMode("video");
    modeRef.current = "video";
    try {
      const stream = await openLiveCamera(facingRef.current);
      if (!stream) return;
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (localRef.current) {
        if (audioTrack) {
          localRef.current.getAudioTracks().forEach((t) => t.stop());
          localRef.current.addTrack(audioTrack);
          audioTrack.enabled = !micMutedRef.current;
        }
        localRef.current.addTrack(videoTrack);
        for (const pc of pcsRef.current.values()) {
          if (audioTrack) {
            const audioSender = pc.getSenders().find((s) => s.track?.kind === "audio");
            if (audioSender) await audioSender.replaceTrack(audioTrack);
          }
          pc.addTrack(videoTrack, localRef.current);
          const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          const peerId = [...pcsRef.current.entries()].find(([, v]) => v === pc)?.[0];
          if (peerId) await postSignal("sdp", { peerId, ...sdpPayload(pc.localDescription!) });
        }
      } else {
        localRef.current = stream;
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localRef.current;
        fitLiveVideo(localVideoRef.current, facingRef.current === "user");
        void localVideoRef.current.play().catch(() => {});
      }
      setSpeakerOn(true);
    } catch { setHint("Could not open camera"); }
  }

  const title =
    people.length > 1 ? `${people[0]?.name || other.name} + ${people.length - 1}` : other.name;
  const label =
    status === "ringing-in"
      ? mode === "video" ? "Incoming video call…" : "Incoming voice call…"
      : status === "ringing-out"
        ? "Calling…"
        : status === "connecting"
          ? "Connecting…"
          : elapsed > 0
            ? formatDuration(elapsed)
            : "Connected";

  const showVideo = mode === "video" && (status === "connected" || status === "connecting" || status === "ringing-out");

  return (
    <div className="fixed inset-0 z-[300] flex flex-col text-white">
      {/* Background */}
      {showVideo ? (
        <div className="absolute inset-0 bg-black" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#0f172a]" />
      )}

      <div className="relative min-h-0 flex-1">
        {/* Video grid */}
        {showVideo && remoteKeys.length ? (
          <div className={`grid h-full ${remoteKeys.length > 1 ? "grid-cols-2 grid-rows-2" : "grid-cols-1"}`}>
            {remoteKeys.map((peerId) => {
              const person = people.find((p) => p.id === peerId) || other;
              return (
                <div key={peerId} className="relative min-h-0 bg-zinc-900">
                  <video
                    ref={(el) => {
                      if (!el) { remoteVideosRef.current.delete(peerId); return; }
                      remoteVideosRef.current.set(peerId, el);
                      const s = remoteStreamsRef.current.get(peerId);
                      if (s && el.srcObject !== s) { el.srcObject = s; void el.play().catch(() => {}); }
                    }}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <p className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
                    {person.name}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          /* Audio call UI */
          <div className="flex h-full flex-col items-center justify-center gap-5 px-6">
            {/* Pulsing rings on audio call */}
            <div className="relative">
              {(status === "ringing-in" || status === "ringing-out") && (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-white/10" style={{ animationDuration: "2s" }} />
                  <span className="absolute -inset-4 animate-ping rounded-full bg-white/5" style={{ animationDuration: "2.5s" }} />
                </>
              )}
              {people.length > 1 ? (
                <div className="relative flex -space-x-4">
                  {people.slice(0, 4).map((p) => (
                    <span key={p.id} className="ring-2 ring-[#1e293b] rounded-full">
                      <Avatar name={p.name} hue={p.avatarHue} src={p.avatarUrl} size={80} />
                    </span>
                  ))}
                </div>
              ) : (
                <span className="block rounded-full ring-4 ring-white/10">
                  <Avatar name={other.name} hue={other.avatarHue} src={other.avatarUrl} size={120} />
                </span>
              )}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold tracking-tight">{title}</p>
              <p className="mt-1.5 text-sm font-medium text-white/60">{hint || label}</p>
            </div>
            {hint === "Tap to hear" && (
              <button
                type="button"
                className="mt-1 rounded-full bg-white/15 px-5 py-2 text-sm font-semibold backdrop-blur-sm"
                onClick={() => {
                  for (const audio of remoteAudiosRef.current.values()) {
                    void audio.play().catch(() => {});
                  }
                  setHint("");
                }}
              >
                Tap to enable audio
              </button>
            )}
          </div>
        )}

        {/* Local camera PiP */}
        {showVideo && (
          <div className="absolute right-3 bottom-32 z-10">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="h-40 w-28 rounded-2xl bg-black object-cover shadow-2xl ring-1 ring-white/20"
            />
            {camOff && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-zinc-800/90">
                <VideoOff className="h-6 w-6 text-white/50" />
              </div>
            )}
          </div>
        )}

        {/* Title overlay on video call */}
        {showVideo && (
          <div className="pointer-events-none absolute inset-x-0 top-0 pt-[max(1rem,env(safe-area-inset-top))] text-center">
            <p className="text-sm font-bold drop-shadow-lg">{title}</p>
            <p className="text-xs font-medium text-white/70 drop-shadow-lg">{hint || label}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-20 shrink-0 rounded-t-3xl bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 backdrop-blur-md">
        {status === "ringing-in" ? (
          <div className="flex items-center justify-center gap-8">
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => void hangup("reject")}
                className="grid h-16 w-16 place-items-center rounded-full bg-red-500 shadow-lg shadow-red-500/30"
                aria-label="Decline"
              >
                <PhoneOff className="h-7 w-7" />
              </button>
              <span className="text-[11px] font-medium text-white/60">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => void acceptIncoming()}
                className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30"
                aria-label="Accept"
              >
                {mode === "video" ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
              </button>
              <span className="text-[11px] font-medium text-white/60">Accept</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <ControlBtn
              icon={micMuted ? MicOff : Mic}
              label={micMuted ? "Unmute" : "Mute"}
              active={micMuted}
              onClick={() => setMicMuted((v) => !v)}
            />
            {mode === "video" ? (
              <ControlBtn
                icon={camOff ? VideoOff : Video}
                label={camOff ? "Camera on" : "Camera off"}
                active={camOff}
                onClick={() => setCamOff((v) => !v)}
              />
            ) : (
              <ControlBtn
                icon={speakerOn ? Volume2 : VolumeX}
                label={speakerOn ? "Speaker" : "Earpiece"}
                active={speakerOn}
                onClick={() => setSpeakerOn((v) => !v)}
              />
            )}
            {mode === "video" ? (
              <ControlBtn
                icon={SwitchCamera}
                label="Flip"
                onClick={() => void flipCamera()}
              />
            ) : (
              <ControlBtn
                icon={Video}
                label="Video"
                onClick={() => void upgradeToVideo()}
              />
            )}
            <ControlBtn
              icon={UserPlus}
              label="Add"
              onClick={() => void openPicker()}
            />
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => void hangup("hangup")}
                className="grid h-16 w-16 place-items-center rounded-full bg-red-500 shadow-lg shadow-red-500/30"
                aria-label="End call"
              >
                <PhoneOff className="h-7 w-7" />
              </button>
              <span className="text-[11px] font-medium text-white/60">End</span>
            </div>
          </div>
        )}
      </div>

      {/* People picker */}
      {picker && (
        <div className="absolute inset-0 z-30 flex flex-col bg-black/85 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-lg">
          <div className="flex items-center justify-between px-5 pb-3">
            <p className="text-lg font-bold">Add to call</p>
            <button type="button" onClick={() => setPicker(null)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8">
            {picker.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-white/50">No contacts to add. Chat with people first.</p>
            ) : (
              picker.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void addPerson(p)}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-white/10"
                >
                  <Avatar name={p.name} hue={p.avatarHue} src={p.avatarUrl} size={44} />
                  <span className="font-semibold">{p.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ControlBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Mic;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className={`grid h-14 w-14 place-items-center rounded-full transition-colors ${
          active ? "bg-white text-[#141414]" : "bg-white/15 text-white"
        }`}
        aria-label={label}
      >
        <Icon className="h-6 w-6" />
      </button>
      <span className="text-[11px] font-medium text-white/60">{label}</span>
    </div>
  );
}
