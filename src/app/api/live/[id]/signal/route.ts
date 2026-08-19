import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { getLiveSession, pullSignals, pushSignal, expireStaleLiveSessions } from "@/lib/live";
import { touchPresence } from "@/lib/chat-presence";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  await touchPresence(me);
  await expireStaleLiveSessions();
  const { id } = await params;
  const session = await getLiveSession(id);
  if (!session) return json({ error: "Live not found." }, 404);
  const url = new URL(req.url);
  const peer = url.searchParams.get("peer") || "";
  const after = url.searchParams.get("after") || undefined;
  if (!peer) return json({ error: "Missing peer." }, 400);
  const signals = await pullSignals(id, peer, after);
  return json({ signals, status: session.status, viewerCount: session.viewerCount });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  await touchPresence(me);
  const { id } = await params;
  const session = await getLiveSession(id);
  if (!session || session.status !== "live") return json({ error: "This live ended." }, 400);
  const body = await req.json().catch(() => null);
  const fromPeer = String(body?.fromPeer || "");
  const toPeer = String(body?.toPeer || "");
  const kind = String(body?.kind || "");
  if (!fromPeer || !toPeer || !["offer", "answer", "ice", "join", "leave"].includes(kind)) {
    return json({ error: "Bad signal." }, 400);
  }
  if (fromPeer !== `host:${me}` && fromPeer !== `viewer:${me}` && fromPeer !== `guest:${me}`) {
    return json({ error: "Peer mismatch." }, 403);
  }
  const signal = await pushSignal({
    sessionId: id,
    fromPeer,
    toPeer,
    kind: kind as "offer" | "answer" | "ice" | "join" | "leave",
    payload: body?.payload ?? {},
  });
  return json({ signal });
}
