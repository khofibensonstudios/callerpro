import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { pushActivity } from "@/lib/inbox";
import { mentionedUsers } from "@/lib/mentions";
import { publicUser, withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const comments = await withDb((db) =>
    (db.comments ??= [])
      .filter((c) => c.postId === id)
      .map((c) => {
        const author = db.users.find((u) => u.id === c.authorId);
        return { ...c, likedBy: c.likedBy ?? [], author: author ? publicUser(author) : null };
      }),
  );
  return json({ comments, count: comments.length });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in to comment." }, 401);
  const { id } = await params;
  const payload = (await req.json().catch(() => null)) as { body?: string } | null;
  const text = payload?.body?.trim() ?? "";
  if (text.length < 1) return json({ error: "Write a comment." }, 400);

  const saved = await withDb((db) => {
    db.comments ??= [];
    const post = db.posts.find((p) => p.id === id);
    if (!post) return null;
    const comment = {
      id: `c_${crypto.randomUUID()}`,
      postId: id,
      authorId: me,
      body: text.slice(0, 2000),
      createdAt: new Date().toISOString(),
      likedBy: [] as string[],
    };
    db.comments.push(comment);
    pushActivity(db, { userId: post.authorId, actorId: me, kind: "comment", refId: id });
    for (const tagged of mentionedUsers(comment.body, db.users)) {
      if (tagged.id === me) continue;
      pushActivity(db, { userId: tagged.id, actorId: me, kind: "mention", refId: id });
    }
    const author = db.users.find((u) => u.id === me);
    return { ...comment, author: author ? publicUser(author) : null };
  }, true);
  if (!saved) return json({ error: "Post not found." }, 404);
  return json({ comment: saved });
}
