import { json, options } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { listHostHistory } from "@/lib/live";
import { withDb, toClientPost, publicUser } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const me = await requireUser(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const lives = await listHostHistory(me.id);
  const clips = await withDb((db) =>
    db.posts
      .filter((p) => p.authorId === me.id && (p.kind === "video" || p.kind === "clip") && p.published !== false)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 20)
      .map((p) => ({ post: toClientPost(p), author: publicUser(db.users.find((u) => u.id === me.id)!) })),
  );
  return json({ lives, clips });
}
