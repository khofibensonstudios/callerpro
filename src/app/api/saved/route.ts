import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { publicUser, toClientPost, withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const data = await withDb((db) => {
    const ids = (db.saves ?? [])
      .filter((s) => s.userId === me)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((s) => s.postId);
    const authors = Object.fromEntries(db.users.map((u) => [u.id, publicUser(u)]));
    const items = ids
      .map((id) => {
        const post = db.posts.find((p) => p.id === id);
        if (!post || post.published === false) return null;
        const author = authors[post.authorId];
        if (!author) return null;
        return { post: toClientPost(post), author };
      })
      .filter(Boolean);
    return { ids, items };
  });
  return json(data);
}
