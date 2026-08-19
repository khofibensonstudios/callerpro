import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { publicUser, toClientPost, withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const me = await userIdFromRequest(_req);
  const data = await withDb((db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) return null;
    const posts = db.posts
      .filter((p) => p.authorId === id && p.published !== false)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((p) => toClientPost(p));
    const followers = db.follows.filter((f) => f.followingId === id).length;
    const following = db.follows.filter((f) => f.followerId === id).length;
    const youFollow = me ? db.follows.some((f) => f.followerId === me && f.followingId === id) : false;
    return {
      user: publicUser(user),
      posts,
      followers,
      following,
      youFollow,
    };
  });
  if (!data) return json({ error: "Creator not found." }, 404);
  return json(data);
}
