/** Shared WebRTC config for Connect Pro live (host + viewer). */
export const LIVE_ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // VPS coturn
    {
      urls: ["turn:67.217.59.81:3478?transport=udp", "turn:67.217.59.81:3478?transport=tcp"],
      username: "connectpro",
      credential: "CpLiveTurn2026!",
    },
    // Public fallback relays (phone↔phone on cellular)
    {
      urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443"],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: ["turn:openrelay.metered.ca:80?transport=tcp", "turn:openrelay.metered.ca:443?transport=tcp"],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 8,
};

export function sdpPayload(desc: RTCSessionDescription | RTCSessionDescriptionInit) {
  return { type: desc.type, sdp: desc.sdp };
}

export function asSessionDescription(raw: unknown): RTCSessionDescriptionInit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  // Support { type, sdp } or nested { sdp: { type, sdp } }
  const inner = o.sdp && typeof o.sdp === "object" ? (o.sdp as Record<string, unknown>) : o;
  const type = String(inner.type || o.type || "");
  const sdp = String(inner.sdp || (typeof o.sdp === "string" ? o.sdp : "") || "");
  if ((type !== "offer" && type !== "answer") || !sdp) return null;
  return { type: type as RTCSdpType, sdp };
}

export function asIceCandidate(raw: unknown): RTCIceCandidateInit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const c = (o.candidate && typeof o.candidate === "object" ? o.candidate : o) as Record<string, unknown>;
  if (typeof c.candidate !== "string" && c.candidate !== null) return null;
  return {
    candidate: (c.candidate as string) || undefined,
    sdpMid: (c.sdpMid as string) ?? undefined,
    sdpMLineIndex: typeof c.sdpMLineIndex === "number" ? c.sdpMLineIndex : undefined,
    usernameFragment: (c.usernameFragment as string) ?? undefined,
  };
}
