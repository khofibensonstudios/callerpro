import { z } from "zod";
import { json, options } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { withDb } from "@/lib/store";
import { defaultSettings, mergeSettings } from "@/lib/settings";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return json({ error: "Sign in required." }, 401);
  const settings = await withDb((db) => mergeSettings(db.users.find((u) => u.id === user.id)?.settings));
  return json({ settings });
}

const patch = z.object({
  privateAccount: z.boolean().optional(),
  followWho: z.enum(["everyone", "approved", "nobody"]).optional(),
  theme: z.enum(["light", "dark"]).optional(),
  adsOnLive: z.boolean().optional(),
  adsPersonalized: z.boolean().optional(),
  adsHidden: z.array(z.string()).optional(),
  verifyRequested: z.boolean().optional(),
  adCampaigns: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(80),
        promote: z.enum(["profile", "shop", "link"]),
        link: z.string().max(500).optional(),
        dailyBudget: z.number().min(1).max(10000),
        status: z.enum(["running", "paused", "ended"]),
        createdAt: z.string(),
      }),
    )
    .optional(),
});

export async function PATCH(req: Request) {
  const user = await requireUser(req);
  if (!user) return json({ error: "Sign in required." }, 401);
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid settings." }, 400);
  const settings = await withDb((db) => {
    const found = db.users.find((u) => u.id === user.id);
    if (!found) return defaultSettings();
    found.settings = { ...mergeSettings(found.settings), ...parsed.data };
    return found.settings;
  }, true);
  return json({ settings });
}
