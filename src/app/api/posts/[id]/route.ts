import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { publicUser, toClientPost, withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  const { id } = await params;
  const data = await withDb((db) => {
    const post = db.posts.find((p) => p.id === id);
    if (!post) return null;
    const author = db.users.find((u) => u.id === post.authorId);
    if (!author) return null;
    if (post.published === false && post.authorId !== me) return null;
    if (post.hidden && post.authorId !== me) return null;
    if (author.accountStatus && author.accountStatus !== "active" && post.authorId !== me) return null;
    return { post: toClientPost(post, true), author: publicUser(author), mine: me === post.authorId };
  });
  if (!data) return json({ error: "Post not found." }, 404);
  return json(data);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    body?: string;
    coverImage?: string;
    visibility?: "everyone" | "followers";
    published?: boolean;
  } | null;
  const data = await withDb((db) => {
    const post = db.posts.find((p) => p.id === id);
    if (!post || post.authorId !== me) return null;
    if (typeof body?.title === "string" && body.title.trim()) post.title = body.title.trim().slice(0, 140);
    if (typeof body?.body === "string" && body.body.trim()) post.body = body.body.trim();
    if (typeof body?.coverImage === "string") post.coverImage = body.coverImage;
    if (body?.visibility === "everyone" || body?.visibility === "followers") post.visibility = body.visibility;
    if (typeof body?.published === "boolean") post.published = body.published;
    const author = db.users.find((u) => u.id === me);
    return { post: toClientPost(post, true), author: author ? publicUser(author, true) : null };
  }, true);
  if (!data) return json({ error: "You can only edit your own post." }, 404);
  return json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const { id } = await params;
  const ok = await withDb((db) => {
    const post = db.posts.find((p) => p.id === id);
    if (!post || post.authorId !== me) return false;
    db.posts = db.posts.filter((p) => p.id !== id);
    db.comments = (db.comments ?? []).filter((c) => c.postId !== id);
    db.saves = (db.saves ?? []).filter((s) => s.postId !== id);
    db.deletedIds = [...new Set([...(db.deletedIds ?? []), id])];
    return true;
  }, true);
  if (!ok) return json({ error: "You can only delete your own post." }, 404);
  return json({ ok: true });
}
