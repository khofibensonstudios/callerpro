import { ensureSchema, usingPostgres, withClient } from "@/lib/db/pool";

type Presence = {
  at: number;
  typingThread?: string;
  typingUntil?: number;
};

const ONLINE_MS = 120_000; // 2 minutes
const presence = new Map<string, Presence>();

export async function touchPresence(userId: string, typingThread?: string | null) {
  const now = Date.now();
  const cur = presence.get(userId) || { at: now };
  cur.at = now;
  if (typingThread) {
    cur.typingThread = typingThread;
    cur.typingUntil = now + 5000;
  } else if (typingThread === null) {
    cur.typingThread = undefined;
    cur.typingUntil = undefined;
  }
  presence.set(userId, cur);

  if (!usingPostgres()) return;
  try {
    await ensureSchema();
    await withClient(async (client) => {
      if (typingThread) {
        await client.query(
          `INSERT INTO user_presence (user_id, last_seen, typing_thread, typing_until)
           VALUES ($1, now(), $2, now() + interval '5 seconds')
           ON CONFLICT (user_id) DO UPDATE SET
             last_seen = now(),
             typing_thread = EXCLUDED.typing_thread,
             typing_until = EXCLUDED.typing_until`,
          [userId, typingThread],
        );
      } else if (typingThread === null) {
        await client.query(
          `INSERT INTO user_presence (user_id, last_seen, typing_thread, typing_until)
           VALUES ($1, now(), NULL, NULL)
           ON CONFLICT (user_id) DO UPDATE SET
             last_seen = now(),
             typing_thread = NULL,
             typing_until = NULL`,
          [userId],
        );
      } else {
        await client.query(
          `INSERT INTO user_presence (user_id, last_seen)
           VALUES ($1, now())
           ON CONFLICT (user_id) DO UPDATE SET last_seen = now()`,
          [userId],
        );
      }
    });
  } catch {
    /* keep memory fallback */
  }
}

export async function readPresence(userId: string, threadId?: string) {
  const now = Date.now();
  let at = 0;
  let typingThread: string | undefined;
  let typingUntil = 0;

  const mem = presence.get(userId);
  if (mem) {
    at = mem.at;
    typingThread = mem.typingThread;
    typingUntil = mem.typingUntil || 0;
  }

  if (usingPostgres()) {
    try {
      await ensureSchema();
      const row = await withClient(async (client) => {
        const res = await client.query(
          `SELECT EXTRACT(EPOCH FROM last_seen) * 1000 AS at,
                  typing_thread,
                  EXTRACT(EPOCH FROM typing_until) * 1000 AS typing_until
           FROM user_presence WHERE user_id = $1`,
          [userId],
        );
        return res.rows[0] as
          | { at?: string | number; typing_thread?: string; typing_until?: string | number }
          | undefined;
      });
      if (row?.at != null) {
        const dbAt = Number(row.at) || 0;
        if (dbAt >= at) {
          at = dbAt;
          typingThread = row.typing_thread || undefined;
          typingUntil = Number(row.typing_until) || 0;
        }
      }
    } catch {
      /* memory only */
    }
  }

  let online = at > 0 && now - at < ONLINE_MS;

  if (!online && usingPostgres()) {
    try {
      const live = await withClient(async (client) => {
        const res = await client.query(
          `SELECT 1 FROM live_sessions WHERE host_id = $1 AND status = 'live' LIMIT 1`,
          [userId],
        );
        return (res.rowCount || 0) > 0;
      });
      if (live) online = true;
    } catch {
      /* ignore */
    }
  }

  // Refresh memory from live signal
  if (online && at > 0) {
    const cur = presence.get(userId) || { at };
    if (at >= cur.at) {
      cur.at = at;
      presence.set(userId, cur);
    }
  }

  const typing =
    Boolean(threadId) && online && typingThread === threadId && typingUntil > now;

  return { online, typing, lastSeenAt: at || null };
}
