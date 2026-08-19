import { ensureSchema, usingPostgres, withClient } from "@/lib/db/pool";

export type CallStatus = "ringing" | "connected" | "ended";
export type CallMode = "audio" | "video";
export type CallKind = "invite" | "accept" | "reject" | "hangup" | "sdp" | "ice";

export const CALL_MAX_PEOPLE = 8;

export type ChatCall = {
  threadId: string;
  callerId: string;
  calleeId: string;
  status: CallStatus;
  mode: CallMode;
  participantIds: string[];
  joinedIds: string[];
  updatedAt: string;
};

export type CallSignal = {
  id: string;
  threadId: string;
  fromId: string;
  toId: string;
  kind: CallKind;
  payload: unknown;
  createdAt: string;
};

const calls = new Map<string, ChatCall>();
const signals: CallSignal[] = [];
const RING_MS = 60_000;
const SIGNAL_TTL_MS = 120_000;
const HISTORY_MS = 14 * 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function uniq(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

function asMode(value: unknown): CallMode {
  return value === "video" ? "video" : "audio";
}

function asIds(value: unknown): string[] {
  if (Array.isArray(value)) return uniq(value.map(String));
  return [];
}

export function inCall(call: ChatCall, userId: string) {
  return call.participantIds.includes(userId) || call.callerId === userId || call.calleeId === userId;
}

function rowToCall(row: {
  thread_id: string;
  caller_id: string;
  callee_id: string;
  status: string;
  updated_at: string | Date;
  mode?: string;
  participant_ids?: string[] | null;
  joined_ids?: string[] | null;
}): ChatCall {
  const participantIds = asIds(row.participant_ids);
  const joinedIds = asIds(row.joined_ids);
  return {
    threadId: row.thread_id,
    callerId: row.caller_id,
    calleeId: row.callee_id,
    status: row.status as CallStatus,
    mode: asMode(row.mode),
    participantIds: participantIds.length ? participantIds : uniq([row.caller_id, row.callee_id]),
    joinedIds: joinedIds.length ? joinedIds : [row.caller_id],
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function pruneMem() {
  const cut = Date.now() - SIGNAL_TTL_MS;
  for (let i = signals.length - 1; i >= 0; i--) {
    if (+new Date(signals[i].createdAt) < cut) signals.splice(i, 1);
  }
  for (const [id, c] of calls) {
    if (c.status === "ended") {
      if (Date.now() - +new Date(c.updatedAt) > HISTORY_MS) calls.delete(id);
    } else if (c.status === "ringing" && Date.now() - +new Date(c.updatedAt) > RING_MS) {
      c.status = "ended";
      c.updatedAt = nowIso();
    }
  }
}

export async function getCall(threadId: string): Promise<ChatCall | null> {
  pruneMem();
  const mem = calls.get(threadId);
  if (mem && mem.status !== "ended") return mem;

  if (!usingPostgres()) return mem?.status === "ended" ? null : mem || null;

  try {
    await ensureSchema();
    const row = await withClient(async (client) => {
      const res = await client.query(
        `SELECT thread_id, caller_id, callee_id, status, updated_at, mode, participant_ids, joined_ids
         FROM chat_calls WHERE thread_id = $1`,
        [threadId],
      );
      return res.rows[0] as Parameters<typeof rowToCall>[0] | undefined;
    });
    if (!row) return null;
    const call = rowToCall(row);
    if (call.status === "ringing" && Date.now() - +new Date(call.updatedAt) > RING_MS) {
      await endCall(threadId, call.callerId);
      return null;
    }
    if (call.status === "ended") return null;
    calls.set(threadId, call);
    return call;
  } catch {
    return mem && mem.status !== "ended" ? mem : null;
  }
}

export async function findCallForUser(userId: string): Promise<ChatCall | null> {
  pruneMem();
  for (const c of calls.values()) {
    if (c.status === "ended") continue;
    if (inCall(c, userId)) return c;
  }
  if (!usingPostgres()) return null;
  try {
    await ensureSchema();
    const row = await withClient(async (client) => {
      const res = await client.query(
        `SELECT thread_id, caller_id, callee_id, status, updated_at, mode, participant_ids, joined_ids
         FROM chat_calls
         WHERE status IN ('ringing', 'connected')
           AND (caller_id = $1 OR callee_id = $1 OR $1 = ANY(participant_ids))
         ORDER BY updated_at DESC
         LIMIT 1`,
        [userId],
      );
      return res.rows[0] as Parameters<typeof rowToCall>[0] | undefined;
    });
    if (!row) return null;
    const call = rowToCall(row);
    if (call.status === "ringing" && Date.now() - +new Date(call.updatedAt) > RING_MS) {
      await endCall(call.threadId, call.callerId);
      return null;
    }
    calls.set(call.threadId, call);
    return call;
  } catch {
    return null;
  }
}

async function persistCall(call: ChatCall) {
  call.participantIds = uniq(call.participantIds);
  call.joinedIds = uniq(call.joinedIds);
  calls.set(call.threadId, call);
  if (!usingPostgres()) return;
  try {
    await ensureSchema();
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO chat_calls (thread_id, caller_id, callee_id, status, updated_at, mode, participant_ids, joined_ids)
         VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7, $8)
         ON CONFLICT (thread_id) DO UPDATE SET
           caller_id = EXCLUDED.caller_id,
           callee_id = EXCLUDED.callee_id,
           status = EXCLUDED.status,
           updated_at = EXCLUDED.updated_at,
           mode = EXCLUDED.mode,
           participant_ids = EXCLUDED.participant_ids,
           joined_ids = EXCLUDED.joined_ids`,
        [
          call.threadId,
          call.callerId,
          call.calleeId,
          call.status,
          call.updatedAt,
          call.mode,
          call.participantIds,
          call.joinedIds,
        ],
      );
    });
  } catch {
    /* memory only */
  }
}

async function notifyOthers(call: ChatCall, fromId: string, kind: CallKind, payload?: unknown) {
  const targets = call.participantIds.filter((id) => id !== fromId);
  await Promise.all(
    targets.map((toId) =>
      pushCallSignal({
        threadId: call.threadId,
        fromId,
        toId,
        kind,
        payload,
      }),
    ),
  );
}

export async function startCall(
  threadId: string,
  callerId: string,
  calleeIds: string | string[],
  mode: CallMode = "audio",
): Promise<ChatCall | { error: string }> {
  const others = uniq(Array.isArray(calleeIds) ? calleeIds : [calleeIds]).filter((id) => id && id !== callerId);
  const calleeId = others[0];
  if (!calleeId) return { error: "No one to call" };
  const existing = await getCall(threadId);
  if (existing) {
    if (inCall(existing, callerId)) return existing;
    return { error: "Busy" };
  }
  for (const id of others) {
    const otherBusy = await findCallForUser(id);
    if (otherBusy) return { error: "Busy" };
  }

  const call: ChatCall = {
    threadId,
    callerId,
    calleeId,
    status: "ringing",
    mode: asMode(mode),
    participantIds: uniq([callerId, ...others]),
    joinedIds: [callerId],
    updatedAt: nowIso(),
  };
  await persistCall(call);
  await Promise.all(
    others.map((toId) =>
      pushCallSignal({
        threadId,
        fromId: callerId,
        toId,
        kind: "invite",
        payload: { status: "ringing", mode: call.mode },
      }),
    ),
  );
  return call;
}

export async function inviteToCall(
  threadId: string,
  fromId: string,
  userId: string,
): Promise<ChatCall | { error: string }> {
  const call = await getCall(threadId);
  if (!call) return { error: "No call" };
  if (!inCall(call, fromId)) return { error: "Not in call" };
  if (inCall(call, userId)) return call;
  if (call.participantIds.length >= CALL_MAX_PEOPLE) return { error: "Call is full" };
  const busy = await findCallForUser(userId);
  if (busy) return { error: "Busy" };

  call.participantIds = uniq([...call.participantIds, userId]);
  call.updatedAt = nowIso();
  await persistCall(call);
  await pushCallSignal({
    threadId,
    fromId,
    toId: userId,
    kind: "invite",
    payload: { status: call.status, mode: call.mode, group: true },
  });
  return call;
}

export async function acceptCall(threadId: string, userId: string): Promise<ChatCall | { error: string }> {
  const call = await getCall(threadId);
  if (!call) return { error: "No call" };
  if (!inCall(call, userId)) return { error: "Not invited" };
  if (call.status === "ended") return { error: "Ended" };
  if (call.status === "ringing" && call.callerId !== userId && call.calleeId !== userId && !call.participantIds.includes(userId)) {
    return { error: "Not callee" };
  }
  if (call.status === "ringing") call.status = "connected";
  call.joinedIds = uniq([...call.joinedIds, userId]);
  call.updatedAt = nowIso();
  await persistCall(call);
  await notifyOthers(call, userId, "accept", { status: call.status, mode: call.mode });
  return call;
}

export async function rejectOrHangup(threadId: string, userId: string, kind: "reject" | "hangup") {
  const call = await getCall(threadId);
  if (!call) return null;
  if (!inCall(call, userId)) return null;

  const originalPair = userId === call.callerId || userId === call.calleeId;
  const othersJoined = call.joinedIds.filter((id) => id !== userId);

  if (kind === "reject" && call.status === "ringing" && originalPair) {
    call.status = "ended";
    call.updatedAt = nowIso();
    await persistCall(call);
    await notifyOthers(call, userId, "reject", { status: "ended" });
    return call;
  }

  if (kind === "reject" || (kind === "hangup" && othersJoined.length >= 2)) {
    call.participantIds = call.participantIds.filter((id) => id !== userId);
    call.joinedIds = call.joinedIds.filter((id) => id !== userId);
    call.updatedAt = nowIso();
    await persistCall(call);
    await notifyOthers(call, userId, "hangup", { status: call.status, left: userId });
    return call;
  }

  call.status = "ended";
  call.updatedAt = nowIso();
  await persistCall(call);
  await notifyOthers(call, userId, kind, { status: "ended" });
  return call;
}

export async function endCall(threadId: string, userId: string) {
  return rejectOrHangup(threadId, userId, "hangup");
}

export async function pushCallSignal(input: {
  threadId: string;
  fromId: string;
  toId: string;
  kind: CallKind;
  payload?: unknown;
}): Promise<CallSignal> {
  pruneMem();
  const row: CallSignal = {
    id: `cs_${crypto.randomUUID()}`,
    threadId: input.threadId,
    fromId: input.fromId,
    toId: input.toId,
    kind: input.kind,
    payload: input.payload ?? null,
    createdAt: nowIso(),
  };
  signals.push(row);

  if (usingPostgres()) {
    try {
      await ensureSchema();
      await withClient(async (client) => {
        await client.query(
          `INSERT INTO chat_call_signals (id, thread_id, from_id, to_id, kind, payload, created_at)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)`,
          [
            row.id,
            row.threadId,
            row.fromId,
            row.toId,
            row.kind,
            JSON.stringify(row.payload ?? null),
            row.createdAt,
          ],
        );
        await client.query(`DELETE FROM chat_call_signals WHERE created_at < now() - interval '2 minutes'`);
      });
    } catch {
      /* memory only */
    }
  }
  return row;
}

export async function pullCallSignals(
  threadId: string,
  userId: string,
  after?: string | null,
): Promise<CallSignal[]> {
  pruneMem();
  const afterMs = after ? +new Date(after) : 0;

  let list = signals.filter(
    (s) => s.threadId === threadId && s.toId === userId && +new Date(s.createdAt) > afterMs,
  );

  if (usingPostgres()) {
    try {
      await ensureSchema();
      const rows = await withClient(async (client) => {
        const res = await client.query(
          `SELECT id, thread_id, from_id, to_id, kind, payload, created_at
           FROM chat_call_signals
           WHERE thread_id = $1 AND to_id = $2
             AND created_at > COALESCE($3::timestamptz, to_timestamp(0))
           ORDER BY created_at ASC
           LIMIT 80`,
          [threadId, userId, after || null],
        );
        return res.rows as Array<{
          id: string;
          thread_id: string;
          from_id: string;
          to_id: string;
          kind: string;
          payload: unknown;
          created_at: string | Date;
        }>;
      });
      list = rows.map((r) => ({
        id: r.id,
        threadId: r.thread_id,
        fromId: r.from_id,
        toId: r.to_id,
        kind: r.kind as CallKind,
        payload: r.payload,
        createdAt: new Date(r.created_at).toISOString(),
      }));
    } catch {
      /* memory */
    }
  }

  return list.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
}

export async function listRecentCalls(userId: string): Promise<ChatCall[]> {
  pruneMem();
  const mem = [...calls.values()]
    .filter((c) => inCall(c, userId))
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .slice(0, 40);
  if (!usingPostgres()) return mem;
  try {
    await ensureSchema();
    const rows = await withClient(async (client) => {
      const res = await client.query(
        `SELECT thread_id, caller_id, callee_id, status, updated_at, mode, participant_ids, joined_ids
         FROM chat_calls
         WHERE caller_id = $1 OR callee_id = $1 OR $1 = ANY(participant_ids)
         ORDER BY updated_at DESC
         LIMIT 40`,
        [userId],
      );
      return res.rows as Parameters<typeof rowToCall>[0][];
    });
    const mapped = rows.map(rowToCall);
    const byId = new Map(mapped.map((c) => [c.threadId, c]));
    for (const c of mem) if (!byId.has(c.threadId)) byId.set(c.threadId, c);
    return [...byId.values()].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 40);
  } catch {
    return mem;
  }
}

