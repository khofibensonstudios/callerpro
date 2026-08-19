import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { pushActivity } from "@/lib/inbox";
import { withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in to like." }, 401);
  const { id } = await params;
  const result = await withDb((db) => {
    const post = db.posts.find((p) => p.id === id);
    if (!post) return null;
    post.likedBy = post.likedBy ?? [];
    const wasLiked = post.likedBy.includes(me);
    if (wasLiked) post.likedBy = post.likedBy.filter((x) => x !== me);
    else {
      post.likedBy.push(me);
      if (post.authorId !== me) {
        pushActivity(db, { userId: post.authorId, actorId: me, kind: "like", refId: post.id });
      }
    }
    return { likedBy: post.likedBy, liked: post.likedBy.includes(me) };
  }, true);
  if (!result) return json({ error: "Post not found." }, 404);
  return json(result);
}
