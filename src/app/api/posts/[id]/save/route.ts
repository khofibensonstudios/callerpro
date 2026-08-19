import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(_req);
  if (!me) return json({ error: "Sign in to save." }, 401);
  const { id } = await params;
  const result = await withDb((db) => {
    const post = db.posts.find((p) => p.id === id);
    if (!post) return null;
    db.saves ??= [];
    const existing = db.saves.find((s) => s.userId === me && s.postId === id);
    if (existing) {
      db.saves = db.saves.filter((s) => !(s.userId === me && s.postId === id));
      return { saved: false };
    }
    db.saves.push({ userId: me, postId: id, createdAt: new Date().toISOString() });
    return { saved: true };
  }, true);
  if (!result) return json({ error: "Post not found." }, 404);
  return json(result);
}
