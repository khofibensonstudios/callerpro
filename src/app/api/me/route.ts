import { z } from "zod";
import { json, options } from "@/lib/http";
import { requireUser, userIdFromRequest } from "@/lib/auth";
import { publicUser, withDb } from "@/lib/store";
import { SKILLS } from "@/lib/constants";
import type { PostKind } from "@/lib/types";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return json({ error: "Sign in required." }, 401);
  const hasStory = await withDb((db) =>
    db.posts.some(
      (p) =>
        p.authorId === user.id &&
        p.kind === "story" &&
        p.published !== false &&
        Date.now() - +new Date(p.createdAt) < 24 * 60 * 60 * 1000,
    ),
  );
  return json({ user, hasStory });
}

const patch = z.object({
  name: z.string().min(2).max(60).optional(),
  headline: z.string().max(140).optional(),
  bio: z.string().max(500).optional(),
  skills: z.array(z.string()).max(8).optional(),
  formats: z.array(z.enum(["video", "clip", "blog", "note", "story"])).max(5).optional(),
  avatarUrl: z.string().max(2_500_000).optional(),
  coverUrl: z.string().max(2_500_000).optional(),
});

export async function PATCH(req: Request) {
  const id = await userIdFromRequest(req);
  if (!id) return json({ error: "Sign in required." }, 401);
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid profile update." }, 400);

  const skills = parsed.data.skills?.filter((s) => (SKILLS as readonly string[]).includes(s));
  const user = await withDb((db) => {
    const found = db.users.find((u) => u.id === id);
    if (!found) return null;
    if (parsed.data.name) found.name = parsed.data.name;
    if (parsed.data.headline !== undefined) found.headline = parsed.data.headline;
    if (parsed.data.bio !== undefined) found.bio = parsed.data.bio;
    if (skills) {
      found.skills = skills;
    }
    if (parsed.data.formats) {
      found.formats = parsed.data.formats as PostKind[];
    }
    if (parsed.data.avatarUrl !== undefined) found.avatarUrl = parsed.data.avatarUrl;
    if (parsed.data.coverUrl !== undefined) found.coverUrl = parsed.data.coverUrl;
    found.onboarded = true;
    return publicUser(found, true);
  }, true);
  if (!user) return json({ error: "Account missing." }, 404);
  return json({ user });
}
