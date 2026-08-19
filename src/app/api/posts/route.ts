import { z } from "zod";
import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { publicUser, persistDataUrl, withDb } from "@/lib/store";
import { SKILLS } from "@/lib/constants";

export function OPTIONS() {
  return options();
}

const schema = z.object({
  kind: z.enum(["video", "clip", "blog", "note", "story"]),
  title: z.string().min(1).max(140),
  body: z.string().min(1).max(2_000_000),
  skill: z.string().optional(),
  videoUrl: z.string().optional(),
  coverImage: z.string().max(8_000_000).optional(),
  tags: z.array(z.string().max(24)).max(12).optional(),
  taggedUserIds: z.array(z.string()).max(20).optional(),
  hashtags: z.array(z.string().max(32)).max(20).optional(),
  visibility: z.enum(["everyone", "followers"]).optional(),
  published: z.boolean().optional(),
  alsoStory: z.boolean().optional(),
});

export async function POST(req: Request) {
  const id = await userIdFromRequest(req);
  if (!id) return json({ error: "Sign in required." }, 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Add something to post." }, 400);
  const skill =
    parsed.data.skill && (SKILLS as readonly string[]).includes(parsed.data.skill)
      ? parsed.data.skill
      : "Storytelling";
  const title = parsed.data.title.trim() || parsed.data.body.trim().slice(0, 80) || "New post";
  const body = parsed.data.body.trim() || title;
  if ((parsed.data.kind === "video" || parsed.data.kind === "clip") && !parsed.data.videoUrl) {
    return json({ error: "Choose a video first." }, 400);
  }
  if (parsed.data.videoUrl?.startsWith("blob:")) {
    return json({ error: "The video did not save. Pick it again and post." }, 400);
  }
  if (parsed.data.kind === "story" && !parsed.data.coverImage && !parsed.data.videoUrl) {
    return json({ error: "Choose a photo or video for your story." }, 400);
  }
  if (parsed.data.kind === "note" && !parsed.data.coverImage && parsed.data.body.replace(/<[^>]+>/g, " ").trim().length < 1) {
    return json({ error: "Write something or add a photo." }, 400);
  }
  if (parsed.data.kind === "blog") {
    return json({ error: "Blogs are no longer available." }, 410);
  }

  const created = await withDb((db) => {
    const author = db.users.find((u) => u.id === id);
    if (!author) return null;
    const post = {
      id: `p_${crypto.randomUUID()}`,
      authorId: id,
      kind: parsed.data.kind,
      title,
      body,
      skill,
      videoUrl: persistDataUrl(parsed.data.videoUrl) || undefined,
      coverImage: persistDataUrl(parsed.data.coverImage) || undefined,
      tags: parsed.data.taggedUserIds ?? parsed.data.tags?.map((t) => t.trim()).filter(Boolean) ?? [],
      hashtags: parsed.data.hashtags?.map((t) => t.replace(/^#/, "").trim()).filter(Boolean) ?? [],
      visibility: (parsed.data.visibility === "followers" ? "followers" : "everyone") as "everyone" | "followers",
      published: parsed.data.published !== false,
      viewCount: 0,
      earnMicros: 0,
      likedBy: [] as string[],
      createdAt: new Date().toISOString(),
    };
    db.posts.unshift(post);
    if (parsed.data.alsoStory && parsed.data.published !== false && parsed.data.kind !== "story") {
      if (parsed.data.coverImage || parsed.data.videoUrl) {
        db.posts.unshift({
          ...post,
          id: `p_${crypto.randomUUID()}`,
          kind: "story",
        });
      }
    }
    return { post, author: publicUser(author, true) };
  }, true);
  if (!created) return json({ error: "Account missing." }, 404);
  return json(created);
}
