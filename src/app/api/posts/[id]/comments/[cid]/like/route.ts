import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { pushActivity } from "@/lib/inbox";
import { publicUser, withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in to like a comment." }, 401);
  const { id, cid } = await params;

  const saved = await withDb((db) => {
    const comment = (db.comments ??= []).find((c) => c.id === cid && c.postId === id);
    if (!comment) return null;
    comment.likedBy ??= [];
    if (comment.likedBy.includes(me)) {
      comment.likedBy = comment.likedBy.filter((uid) => uid !== me);
    } else {
      comment.likedBy.push(me);
      pushActivity(db, { userId: comment.authorId, actorId: me, kind: "comment_like", refId: id });
    }
    const author = db.users.find((u) => u.id === comment.authorId);
    return { ...comment, author: author ? publicUser(author) : null };
  }, true);
  if (!saved) return json({ error: "Comment not found." }, 404);
  return json({ comment: saved });
}
