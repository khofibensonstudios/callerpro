import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(_req);
  if (!me) return json({ error: "Sign in to repost." }, 401);
  const { id } = await params;
  const result = await withDb((db) => {
    const post = db.posts.find((p) => p.id === id);
    if (!post) return null;
    post.repostedBy = post.repostedBy ?? [];
    if (post.repostedBy.includes(me)) post.repostedBy = post.repostedBy.filter((x) => x !== me);
    else post.repostedBy.push(me);
    return { repostedBy: post.repostedBy, reposted: post.repostedBy.includes(me) };
  }, true);
  if (!result) return json({ error: "Post not found." }, 404);
  return json(result);
}
