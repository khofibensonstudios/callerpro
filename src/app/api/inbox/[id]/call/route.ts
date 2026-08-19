import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { publicUser, withDb } from "@/lib/store";
import {
  acceptCall,
  endCall,
  getCall,
  inCall,
  inviteToCall,
  pullCallSignals,
  pushCallSignal,
  rejectOrHangup,
  startCall,
  type CallKind,
  type CallMode,
} from "@/lib/chat-call";
import { threadMemberIds } from "@/lib/threads";

export function OPTIONS() {
  return options();
}

async function threadAccess(threadId: string, me: string) {
  const others = await withDb((db) => {
    const thread = db.threads.find((t) => t.id === threadId);
    if (!thread) return null;
    const members = threadMemberIds(thread);
    if (!members.includes(me)) return null;
    return members.filter((id) => id !== me);
  });
  if (others) return { ok: true as const, others };
  const call = await getCall(threadId);
  if (call && inCall(call, me)) {
    return { ok: true as const, others: call.participantIds.filter((id) => id !== me) };
  }
  return { ok: false as const, others: [] as string[] };
}

function publicCall(call: NonNullable<Awaited<ReturnType<typeof getCall>>>, me: string) {
  return {
    threadId: call.threadId,
    callerId: call.callerId,
    calleeId: call.calleeId,
    status: call.status,
    mode: call.mode,
    participantIds: call.participantIds,
    joinedIds: call.joinedIds,
    role: call.callerId === me ? ("caller" as const) : ("callee" as const),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const { id } = await params;
  const gate = await threadAccess(id, me);
  if (!gate.ok) return json({ error: "Thread not found." }, 404);

  const url = new URL(req.url);
  const after = url.searchParams.get("after");
  const call = await getCall(id);
  const signals = await pullCallSignals(id, me, after);
  const people = call
    ? await withDb((db) =>
        call.participantIds
          .map((pid) => db.users.find((u) => u.id === pid))
          .filter(Boolean)
          .map((u) => publicUser(u!)),
      )
    : [];
  return json({
    call: call ? publicCall(call, me) : null,
    people,
    signals: signals.map((s) => ({
      id: s.id,
      fromId: s.fromId,
      kind: s.kind,
      payload: s.payload,
      createdAt: s.createdAt,
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const { id } = await params;
  const gate = await threadAccess(id, me);
  if (!gate.ok) return json({ error: "Thread not found." }, 404);

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    kind?: string;
    payload?: unknown;
    mode?: string;
    userId?: string;
  } | null;

  const action = body?.action || "";

  if (action === "invite") {
    if (!gate.others.length) return json({ error: "Thread not found." }, 404);
    const mode = (body?.mode === "video" ? "video" : "audio") as CallMode;
    const result = await startCall(id, me, gate.others, mode);
    if ("error" in result) return json({ error: result.error }, 409);
    return json({ call: publicCall(result, me) });
  }

  if (action === "add") {
    const userId = String(body?.userId || "");
    if (!userId) return json({ error: "Pick a person." }, 400);
    const result = await inviteToCall(id, me, userId);
    if ("error" in result) return json({ error: result.error }, 409);
    return json({ call: publicCall(result, me) });
  }

  if (action === "accept") {
    const result = await acceptCall(id, me);
    if ("error" in result) return json({ error: result.error }, 400);
    return json({ call: publicCall(result, me) });
  }

  if (action === "reject") {
    await rejectOrHangup(id, me, "reject");
    return json({ ok: true });
  }

  if (action === "hangup") {
    await endCall(id, me);
    return json({ ok: true });
  }

  if (action === "signal") {
    const kind = body?.kind as CallKind | undefined;
    if (kind !== "sdp" && kind !== "ice") return json({ error: "Bad signal." }, 400);
    const call = await getCall(id);
    if (!call || !inCall(call, me)) return json({ error: "No call." }, 404);
    const toId =
      typeof (body?.payload as { peerId?: string } | null)?.peerId === "string"
        ? (body!.payload as { peerId: string }).peerId
        : call.callerId === me
          ? call.calleeId
          : call.callerId;
    if (!toId || toId === me || !inCall(call, toId)) return json({ error: "Bad peer." }, 400);
    const signal = await pushCallSignal({
      threadId: id,
      fromId: me,
      toId,
      kind,
      payload: body?.payload ?? null,
    });
    return json({ signal });
  }

  return json({ error: "Unknown action." }, 400);
}
