/** Shared live constants/types safe for client + server. */
export const LIVE_JOIN_MARKER = "__joined__";
export const LIVE_INVITE_PREFIX = "<<live>>";
export const REPLY_PREFIX = "<<reply>>";
export const REACT_PREFIX = "<<react>>";

/** Max guests on stage at once (host is separate). */
export const LIVE_MAX_GUESTS = 12;
/** With this many or fewer guests, host can spotlight someone big. Above → equal grid. */
export const LIVE_SPOTLIGHT_GUEST_LIMIT = 5;

export type LiveInviteHost = {
  id: string;
  name: string;
  avatarHue: number;
  avatarUrl?: string;
};

export type LiveInvitePayload = {
  sessionId: string;
  title?: string;
  host?: LiveInviteHost;
  sharedBy?: LiveInviteHost;
};

export function encodeLiveInvite(
  sessionId: string,
  host?: LiveInviteHost | null,
  title?: string,
  sharedBy?: LiveInviteHost | null,
) {
  // Keep payload tiny — never embed avatar URLs (they can truncate the chat body).
  const slim = (u?: LiveInviteHost | null) =>
    u
      ? {
          id: u.id,
          name: u.name,
          avatarHue: u.avatarHue || 28,
        }
      : undefined;
  const payload = {
    id: sessionId,
    title: (title || "").trim().slice(0, 80) || "Live",
    host: slim(host),
    sharedBy: slim(sharedBy),
  };
  return `${LIVE_INVITE_PREFIX}${JSON.stringify(payload)}`;
}

function extractLiveSessionId(text: string): string | null {
  const m = text.match(/live_[A-Za-z0-9_-]+/);
  return m?.[0] || null;
}

export function parseLiveInvite(body: string): LiveInvitePayload | null {
  if (body.startsWith(LIVE_INVITE_PREFIX)) {
    const rest = body.slice(LIVE_INVITE_PREFIX.length).trim();
    if (rest.startsWith("{")) {
      try {
        const raw = JSON.parse(rest) as {
          id?: string;
          title?: string;
          host?: LiveInviteHost;
          sharedBy?: LiveInviteHost;
        };
        const sessionId = raw.id && raw.id.startsWith("live_") ? raw.id : extractLiveSessionId(rest);
        if (sessionId) {
          return {
            sessionId,
            title: raw.title,
            host: raw.host,
            sharedBy: raw.sharedBy,
          };
        }
      } catch {
        // Truncated / partial JSON — still pull the session id if present
        const sessionId = extractLiveSessionId(rest);
        if (sessionId) {
          const nameMatch = rest.match(/"name"\s*:\s*"((?:\\.|[^"\\])*)"/);
          const hostIdMatch = rest.match(/"host"\s*:\s*\{[^}]*"id"\s*:\s*"([^"]+)"/);
          return {
            sessionId,
            host: hostIdMatch
              ? {
                  id: hostIdMatch[1],
                  name: nameMatch?.[1]?.replace(/\\"/g, '"') || "Live",
                  avatarHue: 28,
                }
              : undefined,
          };
        }
      }
    }
    const plain = rest.split("|")[0]?.trim();
    if (plain?.startsWith("live_")) return { sessionId: plain };
    const fromPlain = extractLiveSessionId(rest);
    return fromPlain ? { sessionId: fromPlain } : null;
  }
  const fromUrl = extractLiveSessionId(body);
  return fromUrl ? { sessionId: fromUrl } : null;
}

export function parseLiveInviteId(body: string): string | null {
  return parseLiveInvite(body)?.sessionId ?? null;
}

export function encodeReply(meta: { id: string; preview: string; name: string }, text: string) {
  return `${REPLY_PREFIX}${JSON.stringify(meta)}\n${text}`;
}

export function parseReply(body: string): { meta: { id: string; preview: string; name: string }; text: string } | null {
  if (!body.startsWith(REPLY_PREFIX)) return null;
  const nl = body.indexOf("\n");
  if (nl < 0) return null;
  try {
    const meta = JSON.parse(body.slice(REPLY_PREFIX.length, nl)) as { id: string; preview: string; name: string };
    return { meta, text: body.slice(nl + 1) };
  } catch {
    return null;
  }
}

export function encodeReact(messageId: string, emoji: string) {
  return `${REACT_PREFIX}${messageId}|${emoji}`;
}

export function parseReact(body: string): { messageId: string; emoji: string } | null {
  if (!body.startsWith(REACT_PREFIX)) return null;
  const rest = body.slice(REACT_PREFIX.length);
  const pipe = rest.indexOf("|");
  if (pipe < 0) return null;
  return { messageId: rest.slice(0, pipe), emoji: rest.slice(pipe + 1) };
}

export type LiveSummary = {
  sessionId: string;
  title: string;
  peakViewers: number;
  totalJoins: number;
  likes: number;
  comments: number;
  newFollowers: number;
  earningsMicros: number;
  earningsLabel: string;
  durationSecs: number;
};
