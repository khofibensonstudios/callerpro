"use client";

import { Maximize2, Minimize2, Mic, MicOff, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { SpeakingWave } from "./SpeakingWave";
import { LIVE_SPOTLIGHT_GUEST_LIMIT } from "@/lib/live-shared";

export type GuestBox = { peer: string; muted: boolean; userId: string };
export type GuestProfile = { name: string; avatarHue: number; avatarUrl?: string };

function gridCols(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count <= 2) return "grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count <= 6) return "grid-cols-3";
  if (count <= 9) return "grid-cols-3";
  return "grid-cols-4";
}

function GuestFace({
  peer,
  stream,
  profile,
  userId,
  tall,
  speakingStream,
  speaking,
}: {
  peer: string;
  stream?: MediaStream | null;
  profile?: GuestProfile;
  userId: string;
  tall?: boolean;
  speakingStream?: MediaStream | null;
  speaking?: boolean;
}) {
  const videoTrack = stream?.getVideoTracks().find((t) => t.readyState === "live");
  const showVideo = !!(videoTrack && videoTrack.enabled && !videoTrack.muted);
  return (
    <>
      {videoTrack ? (
        <video
          id={`guest-video-${peer}`}
          playsInline
          autoPlay
          className={`w-full object-cover ${tall ? "h-full min-h-[12rem]" : "h-full min-h-[5.5rem]"} ${
            showVideo ? "" : "absolute opacity-0"
          }`}
          ref={(el) => {
            if (!el || !stream) return;
            if (el.srcObject !== stream) {
              el.srcObject = stream;
              void el.play().catch(() => {});
            }
          }}
        />
      ) : null}
      {!showVideo ? (
        <div
          className={`grid w-full place-items-center bg-gradient-to-b from-[#2a2a2a] to-[#141414] ${
            tall ? "min-h-[12rem] h-full" : "min-h-[5.5rem] h-full"
          }`}
        >
          <SpeakingWave stream={speaking ? speakingStream : null} active={!!speaking} variant="ring">
            <Avatar
              name={profile?.name || "Guest"}
              hue={profile?.avatarHue ?? 28}
              src={profile?.avatarUrl}
              size={tall ? 72 : 44}
              userId={userId}
              showLive={false}
            />
          </SpeakingWave>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6">
        <p className="truncate text-[11px] font-semibold">{profile?.name || "Guest"}</p>
      </div>
    </>
  );
}

function HostMini({
  hostStream,
  hostName,
}: {
  hostStream?: MediaStream | null;
  hostName: string;
}) {
  return (
    <div className="relative h-[7.5rem] w-[7.25rem] shrink-0 overflow-hidden rounded-2xl border-2 border-white/45 bg-[#1a1a1a] shadow-xl">
      {hostStream ? (
        <video
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
          ref={(el) => {
            if (!el) return;
            if (el.srcObject !== hostStream) {
              el.srcObject = hostStream;
              void el.play().catch(() => {});
            }
          }}
        />
      ) : (
        <div className="grid h-full place-items-center text-[11px] text-white/50">Host</div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-5">
        <p className="truncate text-[11px] font-semibold">{hostName}</p>
      </div>
    </div>
  );
}

export function LiveGuestStage({
  guestBoxes,
  guestStreams,
  guestProfiles,
  spotlightPeer,
  onSpotlight,
  onMute,
  onRemove,
  hostStream,
  hostName = "Host",
}: {
  guestBoxes: GuestBox[];
  guestStreams: Map<string, MediaStream>;
  guestProfiles: Record<string, GuestProfile>;
  spotlightPeer: string | null;
  onSpotlight: (peer: string | null) => void;
  onMute: (peer: string) => void;
  onRemove: (peer: string, userId: string) => void;
  hostStream?: MediaStream | null;
  hostName?: string;
}) {
  if (!guestBoxes.length) return null;

  const equalGrid = guestBoxes.length > LIVE_SPOTLIGHT_GUEST_LIMIT;
  const activeSpotlight =
    !equalGrid && spotlightPeer && guestBoxes.some((g) => g.peer === spotlightPeer) ? spotlightPeer : null;

  function controls(g: GuestBox) {
    const canSpotlight = !equalGrid;
    const isBig = activeSpotlight === g.peer;
    return (
      <div className="absolute top-1.5 right-1.5 z-[2] flex gap-1">
        {canSpotlight ? (
          <button
            type="button"
            onClick={() => onSpotlight(isBig ? null : g.peer)}
            className="grid h-7 w-7 place-items-center rounded-full bg-black/55"
            aria-label={isBig ? "Make small" : "Make big"}
          >
            {isBig ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onMute(g.peer)}
          className="grid h-7 w-7 place-items-center rounded-full bg-black/55"
          aria-label={g.muted ? "Unmute guest" : "Mute guest"}
        >
          {g.muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onRemove(g.peer, g.userId)}
          className="grid h-7 w-7 place-items-center rounded-full bg-red-600/90"
          aria-label="Remove guest"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  function tile(g: GuestBox, tall?: boolean, featured = false) {
    const stream = guestStreams.get(g.peer);
    const profile = guestProfiles[g.userId];
    const showVideo = stream?.getVideoTracks().some((t) => t.readyState === "live" && t.enabled && !t.muted);
    return (
      <SpeakingWave
        key={g.peer}
        stream={g.muted ? null : stream}
        active={!g.muted && !!showVideo}
        className="h-full w-full min-h-0"
        variant="box"
      >
        <div
          className={`relative h-full w-full overflow-hidden border-2 border-white/45 bg-[#1a1a1a] shadow-xl ${
            featured ? "rounded-none border-0" : "rounded-2xl"
          }`}
        >
          <GuestFace
            peer={g.peer}
            stream={stream}
            profile={profile}
            userId={g.userId}
            tall={tall || featured}
            speakingStream={stream}
            speaking={!g.muted && !showVideo}
          />
          {controls(g)}
        </div>
      </SpeakingWave>
    );
  }

  // Guest takes host main stage; host moves into a side box with the others.
  if (activeSpotlight) {
    const big = guestBoxes.find((g) => g.peer === activeSpotlight)!;
    const rest = guestBoxes.filter((g) => g.peer !== activeSpotlight);
    return (
      <div className="pointer-events-auto absolute inset-0 z-[8]">
        <div className="absolute inset-0">{tile(big, true, true)}</div>
        <div className="absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-[9] flex max-h-[min(55vh,28rem)] flex-col-reverse gap-2 overflow-y-auto">
          <HostMini hostStream={hostStream} hostName={hostName} />
          {rest.map((g) => (
            <div key={g.peer} className="h-[7.5rem] w-[7.25rem] shrink-0">
              {tile(g)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (equalGrid) {
    return (
      <div
        className={`pointer-events-auto absolute inset-x-2 top-[4.75rem] bottom-[7.5rem] z-[8] grid gap-1.5 ${gridCols(guestBoxes.length)}`}
      >
        {guestBoxes.map((g) => (
          <div key={g.peer} className="min-h-0">
            {tile(g)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-[8] flex max-h-[min(55vh,28rem)] flex-col-reverse gap-2 overflow-y-auto">
      {guestBoxes.map((g) => (
        <div key={g.peer} className="h-40 w-[8rem] shrink-0">
          {tile(g, true)}
        </div>
      ))}
    </div>
  );
}
