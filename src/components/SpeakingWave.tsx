"use client";

import { useEffect, useRef, useState } from "react";

/** Speaking indicator — box glow or circular rings around a profile. */
export function SpeakingWave({
  stream,
  active = true,
  className = "",
  variant = "box",
  children,
}: {
  stream?: MediaStream | null;
  active?: boolean;
  className?: string;
  variant?: "box" | "ring";
  children: React.ReactNode;
}) {
  const [level, setLevel] = useState(0);
  const raf = useRef(0);
  const streamRef = useRef(stream);
  streamRef.current = stream;

  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }

    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let stopped = false;
    let attachedId = "";

    const detach = () => {
      cancelAnimationFrame(raf.current);
      try {
        source?.disconnect();
      } catch {
        /* ignore */
      }
      source = null;
      analyser = null;
      attachedId = "";
    };

    const attach = () => {
      const s = streamRef.current;
      const audioTracks = s?.getAudioTracks().filter((t) => t.enabled && t.readyState === "live") ?? [];
      const id = audioTracks.map((t) => t.id).join(",") || "";
      if (!audioTracks.length) {
        detach();
        setLevel(0);
        return;
      }
      if (id === attachedId && analyser) return;

      detach();
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!ctx) ctx = new AudioCtx();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        source = ctx.createMediaStreamSource(new MediaStream(audioTracks));
        source.connect(analyser);
        attachedId = id;
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (stopped || !analyser) return;
          const live = streamRef.current?.getAudioTracks().some((t) => t.enabled && t.readyState === "live");
          if (!live) {
            setLevel(0);
            raf.current = requestAnimationFrame(tick);
            return;
          }
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length / 255;
          setLevel(avg > 0.06 ? Math.min(1, avg * 2.2) : 0);
          raf.current = requestAnimationFrame(tick);
        };
        void ctx.resume().then(() => {
          if (!stopped) raf.current = requestAnimationFrame(tick);
        });
      } catch {
        setLevel(0);
      }
    };

    attach();
    const poll = window.setInterval(attach, 800);

    return () => {
      stopped = true;
      window.clearInterval(poll);
      detach();
      void ctx?.close();
      ctx = null;
    };
  }, [active, stream]);

  const speaking = active && level > 0.08;
  const glow = 3 + level * 10;

  if (variant === "ring") {
    const scale = 1 + level * 0.2;
    return (
      <div className={`relative inline-flex items-center justify-center ${className}`}>
        <span
          className={`pointer-events-none absolute inset-[-5px] rounded-full border-2 transition-all duration-150 ${
            speaking ? "border-[#e85d04] opacity-100" : "border-transparent opacity-0"
          }`}
          style={{ transform: `scale(${scale})` }}
        />
        <span
          className={`pointer-events-none absolute inset-[-11px] rounded-full border transition-all duration-200 ${
            speaking ? "border-[#e85d04]/55 opacity-90" : "border-transparent opacity-0"
          }`}
          style={{ transform: `scale(${1 + level * 0.32})` }}
        />
        <span
          className={`pointer-events-none absolute inset-[-17px] rounded-full border transition-all duration-300 ${
            speaking ? "border-[#e85d04]/30 opacity-80" : "border-transparent opacity-0"
          }`}
          style={{ transform: `scale(${1 + level * 0.42})` }}
        />
        <div className="relative z-[1]">{children}</div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative z-[1] h-full w-full min-h-0">{children}</div>
      <span
        className={`pointer-events-none absolute inset-0 z-[2] rounded-2xl transition-[box-shadow,opacity] duration-150 ${
          speaking ? "opacity-100" : "opacity-0"
        }`}
        style={{
          boxShadow: speaking
            ? `inset 0 0 0 2px #e85d04, 0 0 0 ${glow}px rgba(232,93,4,${0.22 + level * 0.35})`
            : undefined,
        }}
      />
    </div>
  );
}
