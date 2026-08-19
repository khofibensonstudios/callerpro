import { z } from "zod";
import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { activateShop, getShop, submitShop, updateShopSettings } from "@/lib/shop";
import { SHOP_CATEGORIES } from "@/lib/shop-shared";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const shop = await getShop(me);
  return json({ shop });
}

const toggle = z.object({
  enabled: z.boolean(),
});

const settings = z.object({
  name: z.string().min(2).max(80).optional(),
  bio: z.string().max(400).optional(),
  category: z.enum(SHOP_CATEGORIES).optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  location: z.string().max(160).optional(),
  locationLat: z.number().nullable().optional(),
  locationLng: z.number().nullable().optional(),
  sells: z.string().max(400).optional(),
  email: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  socials: z
    .object({
      instagram: z.string().max(200).optional(),
      tiktok: z.string().max(200).optional(),
      facebook: z.string().max(200).optional(),
      x: z.string().max(200).optional(),
      youtube: z.string().max(200).optional(),
      whatsapp: z.string().max(200).optional(),
      website: z.string().max(200).optional(),
    })
    .optional(),
  submit: z.literal(true).optional(),
});

export async function POST(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const parsed = toggle.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request." }, 400);
  const shop = await activateShop(me, parsed.data.enabled);
  return json({ shop });
}

export async function PATCH(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const parsed = settings.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid shop settings." }, 400);
  const { submit, ...patch } = parsed.data;
  const saved = await updateShopSettings(me, patch);
  if (!saved) return json({ error: "Enable your shop first." }, 400);
  if (submit) {
    const shop = await submitShop(me);
    if (!shop) return json({ error: "Finish the setup first." }, 400);
    return json({ shop });
  }
  return json({ shop: saved });
}
