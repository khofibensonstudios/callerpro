import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { addLiveComment, getLiveSession, listLiveComments } from "@/lib/live";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getLiveSession(id);
  if (!session) return json({ error: "Live not found." }, 404);
  const after = new URL(req.url).searchParams.get("after") || undefined;
  const comments = await listLiveComments(id, after);
  return json({ comments });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in to comment." }, 401);
  const { id } = await params;
  const session = await getLiveSession(id);
  if (!session || session.status !== "live") return json({ error: "Live not found." }, 404);
  const body = await req.json().catch(() => ({}));
  const text = typeof body?.body === "string" ? body.body : "";
  const comment = await addLiveComment(id, me, text);
  if (!comment) return json({ error: "Write a comment." }, 400);
  return json({ comment });
}
