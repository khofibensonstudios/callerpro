import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { bumpLiveHearts, getLiveHearts, getLiveSession } from "@/lib/live";

export function OPTIONS() {
  return options();
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getLiveSession(id);
  if (!session) return json({ error: "Live not found." }, 404);
  const count = await getLiveHearts(id);
  return json({ count });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const { id } = await params;
  const session = await getLiveSession(id);
  if (!session || session.status !== "live") return json({ error: "Live not found." }, 404);
  const body = await req.json().catch(() => ({}));
  const by = Math.min(12, Math.max(1, Number(body?.by) || 1));
  const count = await bumpLiveHearts(id, by);
  return json({ count });
}
