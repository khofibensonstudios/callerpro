import { json, options } from "@/lib/http";
import { withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function GET() {
  const trends = await withDb((db) =>
    [...db.posts]
      .filter((p) => p.published !== false && p.kind !== "story" && p.kind !== "blog")
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 20)
      .map((p) => ({ id: p.id, title: p.title, kind: p.kind })),
  );
  return json({ trends });
}
