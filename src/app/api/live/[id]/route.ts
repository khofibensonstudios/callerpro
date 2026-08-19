import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { bumpViewers, endLiveSession, getLiveSession, recordLiveJoin, recordLiveLeave, touchLiveHeartbeat } from "@/lib/live";

export function OPTIONS() {
  return options();
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getLiveSession(id);
  if (!session) return json({ error: "Live not found." }, 404);
  return json({ session });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const { id } = await params;
  const summary = await endLiveSession(id, me);
  if (!summary) return json({ error: "Could not end this live." }, 400);
  return json({ ok: true, summary });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body?.action === "heartbeat") {
    if (!me) return json({ error: "Sign in required." }, 401);
    const ok = await touchLiveHeartbeat(id, me);
    if (!ok) return json({ error: "Live not active." }, 400);
    const session = await getLiveSession(id);
    return json({ ok: true, session });
  }
  if (body?.action === "join" && me) {
    await recordLiveJoin(id, me);
  } else if (body?.action === "leave" && me) {
    await recordLiveLeave(id, me);
  } else {
    const delta = body?.delta === -1 ? -1 : body?.delta === 1 ? 1 : 0;
    if (delta) await bumpViewers(id, delta);
  }
  const session = await getLiveSession(id);
  if (!session) return json({ error: "Live not found." }, 404);
  return json({ session });
}

/** Beacon-friendly heartbeat (sendBeacon is always POST). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body?.action !== "heartbeat") return json({ error: "Unsupported." }, 400);
  const ok = await touchLiveHeartbeat(id, me);
  if (!ok) return json({ error: "Live not active." }, 400);
  return json({ ok: true });
}
