import { z } from "zod";
import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { getShop, listSellerProducts, saveProduct, SHOP_CATEGORIES, uniqueSlug } from "@/lib/shop";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const products = await listSellerProducts(me);
  return json({ products });
}

const create = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(4000).optional(),
  priceCents: z.number().int().min(0).max(100_000_000),
  images: z.array(z.string().max(500)).max(8).optional(),
  category: z.string().optional(),
  stock: z.number().int().min(0).max(100_000).optional(),
  published: z.boolean().optional(),
});

export async function POST(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const shop = await getShop(me);
  if (!shop || shop.status === "off") return json({ error: "Activate your shop first." }, 400);
  const parsed = create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid product." }, 400);

  const category = SHOP_CATEGORIES.includes(parsed.data.category as (typeof SHOP_CATEGORIES)[number])
    ? parsed.data.category!
    : "Other";
  const canPublish = shop.status === "verified";
  const product = await saveProduct({
    id: `prd_${crypto.randomUUID().slice(0, 12)}`,
    sellerId: me,
    slug: await uniqueSlug(parsed.data.name),
    name: parsed.data.name.trim(),
    description: (parsed.data.description || "").trim(),
    priceCents: parsed.data.priceCents,
    images: parsed.data.images || [],
    category,
    stock: parsed.data.stock ?? 0,
    published: Boolean(parsed.data.published),
    createdAt: new Date().toISOString(),
  });
  return json({
    product,
    warning: canPublish || !parsed.data.published ? undefined : "Saved. It will go live after we verify your shop.",
  });
}
