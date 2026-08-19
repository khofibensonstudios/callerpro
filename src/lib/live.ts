import { ensureSchema, usingPostgres, withClient } from "@/lib/db/pool";
import { publicUser, withDb } from "@/lib/store";
import type { PublicUser } from "@/lib/types";
import { LIVE_JOIN_MARKER, type LiveSummary, LIVE_MAX_GUESTS } from "@/lib/live-shared";

export { LIVE_JOIN_MARKER, type LiveSummary } from "@/lib/live-shared";
export { LIVE_MAX_GUESTS, LIVE_SPOTLIGHT_GUEST_LIMIT } from "@/lib/live-shared";

export type LiveSession = {
  id: string;
  hostId: string;
  title: string;
  status: "live" | "ended";
  viewerCount: number;
  peakViewers?: number;
  startedAt: string;
  endedAt?: string;
  lastHeartbeatAt?: string;
  host?: PublicUser;
};

type SignalKind = "offer" | "answer" | "ice" | "join" | "leave";

type SignalRow = {
  id: string;
  sessionId: string;
  fromPeer: string;
  toPeer: string;
  kind: SignalKind;
  payload: unknown;
  createdAt: string;
};

export type LiveComment = {
  id: string;
  sessionId: string;
  userId: string;
  body: string;
  createdAt: string;
  author?: PublicUser;
};

export type LiveGuest = {
  sessionId: string;
  userId: string;
  status: "requested" | "accepted" | "rejected";
  createdAt: string;
  user?: PublicUser;
};

type MemLive = {
  sessions: Map<string, LiveSession>;
  signals: SignalRow[];
  comments: LiveComment[];
  hearts: Map<string, number>;
  guests: LiveGuest[];
  viewers: Map<string, Set<string>>;
  followEvents: Map<string, Set<string>>;
  stats: Map<string, LiveSummary>;
};

const mem: MemLive = {
  sessions: new Map(),
  signals: [],
  comments: [],
  hearts: new Map(),
  guests: [],
  viewers: new Map(),
  followEvents: new Map(),
  stats: new Map(),
};

/** Ephemeral stage layout: which guest peer is spotlighted (big). */
const liveSpotlights = new Map<string, string | null>();

function iso(v: Date | string) {
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

async function withHost(session: LiveSession): Promise<LiveSession> {
  const host = await withDb((db) => {
    const u = db.users.find((x) => x.id === session.hostId);
    return u ? publicUser(u) : null;
  });
  return { ...session, host: host || undefined };
}

/** Host must ping within this window or the live is treated as dead (lost internet).
 * Keep this generous so switching apps briefly does not kill a live. */
/** Host can briefly background the app; only end after ~5 min with no beat. */
export const LIVE_HEARTBEAT_STALE_MS = 300_000;

function pruneMemGhosts() {
  const now = Date.now();
  const ancient = now - 90 * 60 * 1000;
  for (const s of mem.sessions.values()) {
    if (s.status !== "live") continue;
    const beat = +new Date(s.lastHeartbeatAt || s.startedAt);
    if (now - beat > LIVE_HEARTBEAT_STALE_MS || +new Date(s.startedAt) < ancient) {
      s.status = "ended";
      s.endedAt = new Date().toISOString();
    }
  }
}

/** End lives whose host stopped sending heartbeats (dropped internet / frozen tab). */
export async function expireStaleLiveSessions() {
  pruneMemGhosts();
  if (!usingPostgres()) return;
  await ensureSchema();
  await withClient(async (client) => {
    await client.query(
      `UPDATE live_sessions
       SET status = 'ended', ended_at = now()
       WHERE status = 'live'
         AND COALESCE(last_heartbeat_at, started_at) < now() - interval '5 minutes'`,
    );
    await client.query(
      `UPDATE live_sessions SET status = 'ended', ended_at = now()
       WHERE status = 'live' AND started_at < now() - interval '90 minutes'`,
    );
  });
}

export async function touchLiveHeartbeat(sessionId: string, hostId: string) {
  const now = new Date().toISOString();
  const memSession = mem.sessions.get(sessionId);
  if (memSession && memSession.hostId === hostId && memSession.status === "live") {
    memSession.lastHeartbeatAt = now;
  }
  if (!usingPostgres()) {
    return Boolean(memSession && memSession.hostId === hostId && memSession.status === "live");
  }
  await ensureSchema();
  const row = await withClient(async (client) => {
    const res = await client.query(
      `UPDATE live_sessions
       SET last_heartbeat_at = now()
       WHERE id = $1 AND host_id = $2 AND status = 'live'
       RETURNING id`,
      [sessionId, hostId],
    );
    return res.rows[0] || null;
  });
  return Boolean(row);
}

export async function listLiveSessions() {
  await expireStaleLiveSessions();
  const byId = new Map<string, LiveSession>();

  if (usingPostgres()) {
    await ensureSchema();
    const rows = await withClient(async (client) => {
      const res = await client.query(
        `SELECT id, host_id, title, status, viewer_count, started_at, ended_at, last_heartbeat_at
         FROM live_sessions WHERE status = 'live' ORDER BY started_at DESC LIMIT 40`,
      );
      return res.rows;
    });
    for (const row of rows) {
      const session: LiveSession = {
        id: row.id,
        hostId: row.host_id,
        title: row.title,
        status: row.status,
        viewerCount: Number(row.viewer_count) || 0,
        startedAt: iso(row.started_at),
        endedAt: row.ended_at ? iso(row.ended_at) : undefined,
        lastHeartbeatAt: row.last_heartbeat_at ? iso(row.last_heartbeat_at) : undefined,
      };
      byId.set(session.id, session);
      mem.sessions.set(session.id, session);
    }

    // Drop mem ghosts that Postgres already ended (or never treat ended rows as live).
    const orphanIds = [...mem.sessions.values()]
      .filter((s) => s.status === "live" && !byId.has(s.id))
      .map((s) => s.id);
    if (orphanIds.length) {
      const statuses = await withClient(async (client) => {
        const res = await client.query(`SELECT id, status FROM live_sessions WHERE id = ANY($1::text[])`, [
          orphanIds,
        ]);
        return res.rows as Array<{ id: string; status: string }>;
      });
      const known = new Map(statuses.map((r) => [r.id, r.status]));
      const endedAt = new Date().toISOString();
      for (const id of orphanIds) {
        const st = known.get(id);
        const s = mem.sessions.get(id);
        if (!s) continue;
        if (st === "ended") {
          s.status = "ended";
          s.endedAt = endedAt;
        } else if (!st) {
          // Mem-only live (PG write may have failed) — still show it.
          byId.set(id, { ...s });
        }
      }
    }
  } else {
    for (const s of mem.sessions.values()) {
      if (s.status === "live") byId.set(s.id, { ...s });
    }
  }

  const list = [...byId.values()].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));
  return Promise.all(list.map(withHost));
}

export async function listHostHistory(hostId: string) {
  await expireStaleLiveSessions();
  if (usingPostgres()) {
    await ensureSchema();
    const rows = await withClient(async (client) => {
      const res = await client.query(
        `SELECT id, host_id, title, status, viewer_count, started_at, ended_at
         FROM live_sessions WHERE host_id = $1 ORDER BY started_at DESC LIMIT 40`,
        [hostId],
      );
      return res.rows;
    });
    return rows.map((row) => ({
      id: row.id as string,
      hostId: row.host_id as string,
      title: row.title as string,
      status: (row.status === "live" ? "live" : "ended") as "live" | "ended",
      viewerCount: Number(row.viewer_count) || 0,
      startedAt: iso(row.started_at),
      endedAt: row.ended_at ? iso(row.ended_at) : undefined,
    }));
  }
  return [...mem.sessions.values()]
    .filter((s) => s.hostId === hostId)
    .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))
    .slice(0, 40);
}

export async function getActiveLiveForHost(hostId: string) {
  await expireStaleLiveSessions();
  if (usingPostgres()) {
    await ensureSchema();
    const row = await withClient(async (client) => {
      const res = await client.query(
        `SELECT id, host_id, title, status, viewer_count, started_at, ended_at, last_heartbeat_at
         FROM live_sessions
         WHERE host_id = $1 AND status = 'live'
         ORDER BY started_at DESC LIMIT 1`,
        [hostId],
      );
      return res.rows[0] || null;
    });
    if (row) {
      const session: LiveSession = {
        id: row.id,
        hostId: row.host_id,
        title: row.title,
        status: row.status,
        viewerCount: Number(row.viewer_count) || 0,
        startedAt: iso(row.started_at),
        endedAt: row.ended_at ? iso(row.ended_at) : undefined,
        lastHeartbeatAt: row.last_heartbeat_at ? iso(row.last_heartbeat_at) : undefined,
      };
      mem.sessions.set(session.id, session);
      return withHost(session);
    }
    // DB says this host is not live — wipe mem ghosts so we never "Resume" a dead session.
    const endedAt = new Date().toISOString();
    for (const s of mem.sessions.values()) {
      if (s.hostId === hostId && s.status === "live") {
        s.status = "ended";
        s.endedAt = endedAt;
      }
    }
    return null;
  }
  for (const s of mem.sessions.values()) {
    if (s.hostId === hostId && s.status === "live") return withHost(s);
  }
  return null;
}

export async function getLiveSession(id: string) {
  await expireStaleLiveSessions();
  if (usingPostgres()) {
    await ensureSchema();
    const row = await withClient(async (client) => {
      const res = await client.query(
        `SELECT id, host_id, title, status, viewer_count, started_at, ended_at, last_heartbeat_at
         FROM live_sessions WHERE id = $1`,
        [id],
      );
      return res.rows[0] || null;
    });
    if (!row) return null;
    return withHost({
      id: row.id,
      hostId: row.host_id,
      title: row.title,
      status: row.status,
      viewerCount: Number(row.viewer_count) || 0,
      startedAt: iso(row.started_at),
      endedAt: row.ended_at ? iso(row.ended_at) : undefined,
      lastHeartbeatAt: row.last_heartbeat_at ? iso(row.last_heartbeat_at) : undefined,
    });
  }
  const s = mem.sessions.get(id);
  return s ? withHost(s) : null;
}

export async function startLiveSession(hostId: string, title: string) {
  // Already live → resume the same session (don't kill stream / force a "fresh" go-live).
  const existing = await getActiveLiveForHost(hostId);
  if (existing) {
    if (title.trim() && title.trim() !== existing.title) {
      if (usingPostgres()) {
        await withClient(async (client) => {
          await client.query(`UPDATE live_sessions SET title = $2 WHERE id = $1 AND status = 'live'`, [
            existing.id,
            title.trim().slice(0, 80),
          ]);
        });
      } else {
        existing.title = title.trim().slice(0, 80);
      }
      return withHost({ ...existing, title: title.trim().slice(0, 80) });
    }
    return existing;
  }

  const id = `live_${crypto.randomUUID()}`;
  const startedAt = new Date().toISOString();
  const session: LiveSession = {
    id,
    hostId,
    title: title.trim() || "Live",
    status: "live",
    viewerCount: 0,
    startedAt,
    lastHeartbeatAt: startedAt,
  };

  // Always keep a memory copy so Live now stays visible even if PG write fails.
  for (const s of mem.sessions.values()) {
    if (s.hostId === hostId && s.status === "live") {
      s.status = "ended";
      s.endedAt = new Date().toISOString();
    }
  }
  mem.sessions.set(id, session);

  if (usingPostgres()) {
    await ensureSchema();
    await withClient(async (client) => {
      await client.query(
        `UPDATE live_sessions SET status = 'ended', ended_at = now()
         WHERE host_id = $1 AND status = 'live'`,
        [hostId],
      );
      await client.query(
        `INSERT INTO live_sessions (id, host_id, title, status, viewer_count, started_at, last_heartbeat_at)
         VALUES ($1,$2,$3,'live',0,$4,$4)`,
        [id, hostId, session.title, startedAt],
      );
    });
  }
  return withHost(session);
}

export async function endLiveSession(id: string, hostId: string): Promise<LiveSummary | null> {
  const session = await getLiveSession(id);
  if (!session || session.hostId !== hostId || session.status !== "live") return null;

  const likes = await getLiveHearts(id);
  let comments = 0;
  let totalJoins = 0;
  let newFollowers = 0;
  let peak = session.peakViewers || session.viewerCount || 0;

  if (usingPostgres()) {
    await ensureSchema();
    const counts = await withClient(async (client) => {
      const cRes = await client.query(
        `SELECT COUNT(*)::int AS n FROM live_comments WHERE session_id = $1 AND body <> $2`,
        [id, LIVE_JOIN_MARKER],
      );
      const jRes = await client.query(`SELECT COUNT(*)::int AS n FROM live_viewers WHERE session_id = $1`, [id]);
      const fRes = await client.query(`SELECT COUNT(*)::int AS n FROM live_follow_events WHERE session_id = $1`, [id]);
      const pRes = await client.query(`SELECT peak_viewers FROM live_sessions WHERE id = $1`, [id]);
      return {
        comments: Number(cRes.rows[0]?.n || 0),
        joins: Number(jRes.rows[0]?.n || 0),
        follows: Number(fRes.rows[0]?.n || 0),
        peak: Number(pRes.rows[0]?.peak_viewers || 0),
      };
    });
    comments = counts.comments;
    totalJoins = counts.joins;
    newFollowers = counts.follows;
    peak = Math.max(peak, counts.peak);
  } else {
    comments = mem.comments.filter((c) => c.sessionId === id && c.body !== LIVE_JOIN_MARKER).length;
    totalJoins = mem.viewers.get(id)?.size || 0;
    newFollowers = mem.followEvents.get(id)?.size || 0;
  }

  const durationSecs = Math.max(1, Math.round((Date.now() - +new Date(session.startedAt)) / 1000));
  // Placeholder earnings for later gifting / ads — stored so history works.
  const earningsMicros = 0;
  const summary: LiveSummary = {
    sessionId: id,
    title: session.title,
    peakViewers: peak,
    totalJoins,
    likes,
    comments,
    newFollowers,
    earningsMicros,
    earningsLabel: `$${(earningsMicros / 1_000_000).toFixed(2)}`,
    durationSecs,
  };

  if (usingPostgres()) {
    await ensureSchema();
    await withClient(async (client) => {
      await client.query(
        `UPDATE live_sessions SET status = 'ended', ended_at = now()
         WHERE id = $1 AND host_id = $2 AND status = 'live'`,
        [id, hostId],
      );
      await client.query(`DELETE FROM live_signals WHERE session_id = $1`, [id]);
      await client.query(
        `INSERT INTO live_stats (
          session_id, host_id, title, peak_viewers, total_joins, likes, comments,
          new_followers, earnings_micros, duration_secs, ended_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
        ON CONFLICT (session_id) DO UPDATE SET
          peak_viewers = EXCLUDED.peak_viewers,
          total_joins = EXCLUDED.total_joins,
          likes = EXCLUDED.likes,
          comments = EXCLUDED.comments,
          new_followers = EXCLUDED.new_followers,
          earnings_micros = EXCLUDED.earnings_micros,
          duration_secs = EXCLUDED.duration_secs,
          ended_at = now()`,
        [
          id,
          hostId,
          session.title,
          summary.peakViewers,
          summary.totalJoins,
          summary.likes,
          summary.comments,
          summary.newFollowers,
          summary.earningsMicros,
          summary.durationSecs,
        ],
      );
    });
  }

  // Always kill the in-memory copy too — otherwise Live Now / Resume keep ghosts.
  const endedAt = new Date().toISOString();
  for (const s of mem.sessions.values()) {
    if (s.id === id || (s.hostId === hostId && s.status === "live")) {
      s.status = "ended";
      s.endedAt = endedAt;
    }
  }
  mem.signals = mem.signals.filter((x) => x.sessionId !== id);
  mem.stats.set(id, summary);
  clearLiveSpotlight(id);

  return summary;
}

export async function forceEndLive(id: string) {
  const session = await getLiveSession(id);
  if (!session || session.status !== "live") return null;
  return endLiveSession(id, session.hostId);
}

export async function listRecentLives(limit = 80): Promise<LiveSession[]> {
  await expireStaleLiveSessions();
  if (usingPostgres()) {
    await ensureSchema();
    const rows = await withClient(async (client) => {
      const res = await client.query(
        `SELECT id, host_id, title, status, viewer_count, peak_viewers, started_at, ended_at
         FROM live_sessions ORDER BY started_at DESC LIMIT $1`,
        [limit],
      );
      return res.rows;
    });
    return Promise.all(
      rows.map((row) =>
        withHost({
          id: String(row.id),
          hostId: String(row.host_id),
          title: String(row.title || "Live"),
          status: row.status === "ended" ? "ended" : "live",
          viewerCount: Number(row.viewer_count) || 0,
          peakViewers: Number(row.peak_viewers) || 0,
          startedAt: iso(row.started_at),
          endedAt: row.ended_at ? iso(row.ended_at) : undefined,
        }),
      ),
    );
  }
  return Promise.all(
    [...mem.sessions.values()]
      .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))
      .slice(0, limit)
      .map((s) => withHost({ ...s })),
  );
}

export async function recordLiveJoin(sessionId: string, userId: string) {
  const session = await getLiveSession(sessionId);
  if (!session || session.status !== "live" || session.hostId === userId) return null;

  let firstJoin = false;
  if (usingPostgres()) {
    await ensureSchema();
    firstJoin = await withClient(async (client) => {
      const existing = await client.query(
        `SELECT user_id FROM live_viewers WHERE session_id = $1 AND user_id = $2`,
        [sessionId, userId],
      );
      if (existing.rows[0]) {
        await client.query(
          `UPDATE live_viewers SET left_at = NULL, joined_at = now() WHERE session_id = $1 AND user_id = $2`,
          [sessionId, userId],
        );
        return false;
      }
      await client.query(
        `INSERT INTO live_viewers (session_id, user_id, joined_at) VALUES ($1,$2,now())`,
        [sessionId, userId],
      );
      return true;
    });
  } else {
    let set = mem.viewers.get(sessionId);
    if (!set) {
      set = new Set();
      mem.viewers.set(sessionId, set);
    }
    firstJoin = !set.has(userId);
    set.add(userId);
  }

  await bumpViewers(sessionId, 1);
  if (firstJoin) {
    return addLiveComment(sessionId, userId, LIVE_JOIN_MARKER);
  }
  return null;
}

export async function recordLiveLeave(sessionId: string, userId: string) {
  if (usingPostgres()) {
    await ensureSchema();
    await withClient(async (client) => {
      await client.query(
        `UPDATE live_viewers SET left_at = now() WHERE session_id = $1 AND user_id = $2 AND left_at IS NULL`,
        [sessionId, userId],
      );
    });
  }
  await bumpViewers(sessionId, -1);
}

export async function recordLiveFollow(hostId: string, followerId: string) {
  if (hostId === followerId) return;
  let sessionId: string | null = null;
  if (usingPostgres()) {
    await ensureSchema();
    sessionId = await withClient(async (client) => {
      const res = await client.query(
        `SELECT id FROM live_sessions WHERE host_id = $1 AND status = 'live' ORDER BY started_at DESC LIMIT 1`,
        [hostId],
      );
      return (res.rows[0]?.id as string) || null;
    });
    if (!sessionId) return;
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO live_follow_events (session_id, follower_id, created_at)
         VALUES ($1,$2,now()) ON CONFLICT DO NOTHING`,
        [sessionId, followerId],
      );
    });
    return;
  }
  for (const s of mem.sessions.values()) {
    if (s.hostId === hostId && s.status === "live") {
      sessionId = s.id;
      break;
    }
  }
  if (!sessionId) return;
  let set = mem.followEvents.get(sessionId);
  if (!set) {
    set = new Set();
    mem.followEvents.set(sessionId, set);
  }
  set.add(followerId);
}

export async function getFollowCounts(userId: string) {
  return withDb((db) => {
    const followers = db.follows.filter((f) => f.followingId === userId).length;
    const following = db.follows.filter((f) => f.followerId === userId).length;
    return { followers, following };
  });
}

export async function bumpViewers(id: string, delta: number) {
  if (usingPostgres()) {
    await ensureSchema();
    await withClient(async (client) => {
      await client.query(
        `UPDATE live_sessions
         SET viewer_count = GREATEST(0, viewer_count + $2),
             peak_viewers = GREATEST(peak_viewers, GREATEST(0, viewer_count + $2))
         WHERE id = $1 AND status = 'live'`,
        [id, delta],
      );
    });
    return;
  }
  const s = mem.sessions.get(id);
  if (s) {
    s.viewerCount = Math.max(0, s.viewerCount + delta);
    s.peakViewers = Math.max(s.peakViewers || 0, s.viewerCount);
  }
}

export async function pushSignal(input: {
  sessionId: string;
  fromPeer: string;
  toPeer: string;
  kind: SignalKind;
  payload: unknown;
}) {
  const row: SignalRow = {
    id: `sig_${crypto.randomUUID()}`,
    sessionId: input.sessionId,
    fromPeer: input.fromPeer,
    toPeer: input.toPeer,
    kind: input.kind,
    payload: input.payload ?? {},
    createdAt: new Date().toISOString(),
  };
  if (usingPostgres()) {
    await ensureSchema();
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO live_signals (id, session_id, from_peer, to_peer, kind, payload, created_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [row.id, row.sessionId, row.fromPeer, row.toPeer, row.kind, JSON.stringify(row.payload), row.createdAt],
      );
      await client.query(
        `DELETE FROM live_signals WHERE session_id = $1 AND created_at < now() - interval '2 minutes'`,
        [row.sessionId],
      );
    });
  } else {
    mem.signals.push(row);
    const cutoff = Date.now() - 120_000;
    mem.signals = mem.signals.filter((s) => +new Date(s.createdAt) >= cutoff);
  }
  return row;
}

export async function pullSignals(sessionId: string, toPeer: string, afterIso?: string) {
  if (usingPostgres()) {
    await ensureSchema();
    const rows = await withClient(async (client) => {
      // Always return a recent window. Clients dedupe by signal id so we never
      // drop an offer/answer that shared a millisecond timestamp with another row.
      const res = await client.query(
        `SELECT id, session_id, from_peer, to_peer, kind, payload, created_at
         FROM live_signals
         WHERE session_id = $1 AND to_peer = $2
           AND created_at > now() - interval '3 minutes'
         ORDER BY created_at ASC
         LIMIT 120`,
        [sessionId, toPeer],
      );
      return res.rows;
    });
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      fromPeer: row.from_peer,
      toPeer: row.to_peer,
      kind: row.kind as SignalKind,
      payload: row.payload,
      createdAt: iso(row.created_at),
    }));
  }
  const cutoff = Date.now() - 180_000;
  return mem.signals.filter(
    (s) => s.sessionId === sessionId && s.toPeer === toPeer && +new Date(s.createdAt) >= cutoff,
  );
}

async function withAuthor(userId: string) {
  return withDb((db) => {
    const u = db.users.find((x) => x.id === userId);
    return u ? publicUser(u) : null;
  });
}

export async function listLiveComments(sessionId: string, afterIso?: string) {
  if (usingPostgres()) {
    await ensureSchema();
    const rows = await withClient(async (client) => {
      const res = afterIso
        ? await client.query(
            `SELECT id, session_id, user_id, body, created_at FROM live_comments
             WHERE session_id = $1 AND created_at > $2 ORDER BY created_at ASC LIMIT 100`,
            [sessionId, afterIso],
          )
        : await client.query(
            `SELECT id, session_id, user_id, body, created_at FROM live_comments
             WHERE session_id = $1 ORDER BY created_at DESC LIMIT 40`,
            [sessionId],
          );
      return afterIso ? res.rows : res.rows.reverse();
    });
    const out: LiveComment[] = [];
    for (const row of rows) {
      out.push({
        id: row.id,
        sessionId: row.session_id,
        userId: row.user_id,
        body: row.body,
        createdAt: iso(row.created_at),
        author: (await withAuthor(row.user_id)) || undefined,
      });
    }
    return out;
  }
  const after = afterIso ? +new Date(afterIso) : 0;
  let list = mem.comments.filter((c) => c.sessionId === sessionId && +new Date(c.createdAt) > after);
  if (!afterIso) list = list.slice(-40);
  return Promise.all(
    list.map(async (c) => ({ ...c, author: (await withAuthor(c.userId)) || undefined })),
  );
}

export async function addLiveComment(sessionId: string, userId: string, body: string) {
  const text = body.trim().slice(0, 200);
  if (!text) return null;
  const row: LiveComment = {
    id: `lc_${crypto.randomUUID()}`,
    sessionId,
    userId,
    body: text,
    createdAt: new Date().toISOString(),
  };
  if (usingPostgres()) {
    await ensureSchema();
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO live_comments (id, session_id, user_id, body, created_at) VALUES ($1,$2,$3,$4,$5)`,
        [row.id, sessionId, userId, text, row.createdAt],
      );
    });
  } else {
    mem.comments.push(row);
  }
  return { ...row, author: (await withAuthor(userId)) || undefined };
}

export async function bumpLiveHearts(sessionId: string, by = 1) {
  if (usingPostgres()) {
    await ensureSchema();
    const n = await withClient(async (client) => {
      await client.query(
        `INSERT INTO live_hearts (session_id, count) VALUES ($1,$2)
         ON CONFLICT (session_id) DO UPDATE SET count = live_hearts.count + $2`,
        [sessionId, by],
      );
      const res = await client.query(`SELECT count FROM live_hearts WHERE session_id = $1`, [sessionId]);
      return Number(res.rows[0]?.count || 0);
    });
    return n;
  }
  const next = (mem.hearts.get(sessionId) || 0) + by;
  mem.hearts.set(sessionId, next);
  return next;
}

export async function getLiveHearts(sessionId: string) {
  if (usingPostgres()) {
    await ensureSchema();
    return withClient(async (client) => {
      const res = await client.query(`SELECT count FROM live_hearts WHERE session_id = $1`, [sessionId]);
      return Number(res.rows[0]?.count || 0);
    });
  }
  return mem.hearts.get(sessionId) || 0;
}

export async function requestLiveGuest(sessionId: string, userId: string) {
  const row: LiveGuest = {
    sessionId,
    userId,
    status: "requested",
    createdAt: new Date().toISOString(),
  };
  if (usingPostgres()) {
    await ensureSchema();
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO live_guests (session_id, user_id, status, created_at)
         VALUES ($1,$2,'requested',$3)
         ON CONFLICT (session_id, user_id) DO UPDATE SET status = 'requested', created_at = $3`,
        [sessionId, userId, row.createdAt],
      );
    });
  } else {
    mem.guests = mem.guests.filter((g) => !(g.sessionId === sessionId && g.userId === userId));
    mem.guests.push(row);
  }
  return { ...row, user: (await withAuthor(userId)) || undefined };
}

export async function listLiveGuests(sessionId: string) {
  if (usingPostgres()) {
    await ensureSchema();
    const rows = await withClient(async (client) => {
      const res = await client.query(
        `SELECT session_id, user_id, status, created_at FROM live_guests
         WHERE session_id = $1 AND status IN ('requested','accepted')
         ORDER BY created_at ASC`,
        [sessionId],
      );
      return res.rows;
    });
    const out: LiveGuest[] = [];
    for (const row of rows) {
      out.push({
        sessionId: row.session_id,
        userId: row.user_id,
        status: row.status,
        createdAt: iso(row.created_at),
        user: (await withAuthor(row.user_id)) || undefined,
      });
    }
    return out;
  }
  return Promise.all(
    mem.guests
      .filter((g) => g.sessionId === sessionId && (g.status === "requested" || g.status === "accepted"))
      .map(async (g) => ({ ...g, user: (await withAuthor(g.userId)) || undefined })),
  );
}

export async function setLiveGuestStatus(
  sessionId: string,
  hostId: string,
  userId: string,
  status: "accepted" | "rejected",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getLiveSession(sessionId);
  if (!session || session.hostId !== hostId) return { ok: false, error: "not_host" };

  if (status === "accepted") {
    const guests = await listLiveGuests(sessionId);
    const accepted = guests.filter((g) => g.status === "accepted");
    const already = accepted.some((g) => g.userId === userId);
    if (!already && accepted.length >= LIVE_MAX_GUESTS) {
      return { ok: false, error: "stage_full" };
    }
  }

  if (usingPostgres()) {
    await ensureSchema();
    await withClient(async (client) => {
      await client.query(
        `UPDATE live_guests SET status = $3 WHERE session_id = $1 AND user_id = $2`,
        [sessionId, userId, status],
      );
    });
    return { ok: true };
  }
  const g = mem.guests.find((x) => x.sessionId === sessionId && x.userId === userId);
  if (!g) return { ok: false, error: "not_found" };
  g.status = status;
  return { ok: true };
}

export function getLiveSpotlight(sessionId: string): string | null {
  return liveSpotlights.has(sessionId) ? liveSpotlights.get(sessionId) ?? null : null;
}

export async function setLiveSpotlight(
  sessionId: string,
  hostId: string,
  spotlightPeer: string | null,
): Promise<boolean> {
  const session = await getLiveSession(sessionId);
  if (!session || session.hostId !== hostId || session.status !== "live") return false;
  if (spotlightPeer && !spotlightPeer.startsWith("guest:")) return false;
  liveSpotlights.set(sessionId, spotlightPeer);
  return true;
}

export function clearLiveSpotlight(sessionId: string) {
  liveSpotlights.delete(sessionId);
}
