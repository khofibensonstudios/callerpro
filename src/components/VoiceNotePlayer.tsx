"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const BAR_COUNT = 28;

function generateBars(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = ((h * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    bars.push(0.15 + 0.85 * ((h % 100) / 100));
  }
  return bars;
}

export function VoiceNotePlayer({
  src,
  mine,
  time,
}: {
  src: string;
  mine: boolean;
  time?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const bars = useRef(generateBars(src));

  const progress = duration > 0 ? current / duration : 0;
  const filledBars = Math.floor(progress * BAR_COUNT);

  useEffect(() => {
    const a = new Audio(src);
    a.preload = "metadata";
    audioRef.current = a;

    const onLoaded = () => { if (Number.isFinite(a.duration)) setDuration(a.duration); };
    const onTime = () => setCurrent(a.currentTime);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    const onDur = () => { if (Number.isFinite(a.duration)) setDuration(a.duration); };

    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);

    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.pause();
      a.src = "";
    };
  }, [src]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = pct * duration;
    setCurrent(a.currentTime);
  }, [duration]);

  const bg = mine ? "bg-[#2a2a2a]" : "bg-white";
  const textMuted = mine ? "text-white/50" : "text-[#8a8580]";
  const barFilled = mine ? "bg-white" : "bg-[#141414]";
  const barEmpty = mine ? "bg-white/25" : "bg-[#d1cdc7]";
  const btnBg = mine ? "bg-white text-[#141414]" : "bg-[#141414] text-white";

  return (
    <div className={`flex items-center gap-2.5 rounded-[22px] px-3 py-2.5 shadow-sm ${bg}`} style={{ minWidth: 220, maxWidth: 300 }}>
      <button
        type="button"
        onClick={toggle}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${btnBg}`}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
      </button>
      <div className="min-w-0 flex-1">
        {/* Waveform bars */}
        <div
          className="flex h-6 cursor-pointer items-end gap-[2px]"
          onClick={seek}
          role="slider"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
        >
          {bars.current.map((h, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full transition-colors ${i <= filledBars ? barFilled : barEmpty}`}
              style={{ height: `${Math.max(14, h * 100)}%` }}
            />
          ))}
        </div>
        <div className={`mt-0.5 flex items-center justify-between text-[10px] ${textMuted}`}>
          <span>{playing || current > 0 ? formatTime(current) : formatTime(duration)}</span>
          {time && <span>{time}</span>}
        </div>
      </div>
    </div>
  );
}
