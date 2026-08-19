import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { toClientPost, withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const id = await userIdFromRequest(req);
  if (!id) return json({ error: "Sign in required." }, 401);
  const drafts = await withDb((db) =>
    db.posts
      .filter((p) => p.authorId === id && p.published === false)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((p) => toClientPost(p, true)),
  );
  return json({ drafts });
}
