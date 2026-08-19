import { json, options } from "@/lib/http";
import { publicUser, withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const skill = new URL(req.url).searchParams.get("skill");
  const creators = await withDb((db) =>
    db.users
      .filter((u) => u.onboarded && (!skill || u.skills.includes(skill)))
      .map((u) => ({
        ...publicUser(u),
        posts: db.posts.filter((p) => p.authorId === u.id).length,
      }))
      .sort((a, b) => b.lifetimeMicros - a.lifetimeMicros),
  );
  return json({ creators });
}
