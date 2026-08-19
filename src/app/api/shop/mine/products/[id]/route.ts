import { z } from "zod";
import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { deleteProduct, getProduct, getShop, saveProduct, SHOP_CATEGORIES, uniqueSlug } from "@/lib/shop";

export function OPTIONS() {
  return options();
}

const patch = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(4000).optional(),
  priceCents: z.number().int().min(0).max(100_000_000).optional(),
  images: z.array(z.string().max(500)).max(8).optional(),
  category: z.string().optional(),
  stock: z.number().int().min(0).max(100_000).optional(),
  published: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const { id } = await params;
  const product = await getProduct(id);
  if (!product || product.sellerId !== me) return json({ error: "Product not found." }, 404);
  const shop = await getShop(me);
  const parsed = patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid product." }, 400);

  const category =
    parsed.data.category && SHOP_CATEGORIES.includes(parsed.data.category as (typeof SHOP_CATEGORIES)[number])
      ? parsed.data.category
      : product.category;
  const name = parsed.data.name?.trim() || product.name;
  const canPublish = shop?.status === "verified";
  const next = await saveProduct({
    ...product,
    name,
    slug: name !== product.name ? await uniqueSlug(name, product.id) : product.slug,
    description: parsed.data.description !== undefined ? parsed.data.description.trim() : product.description,
    priceCents: parsed.data.priceCents ?? product.priceCents,
    images: parsed.data.images ?? product.images,
    category,
    stock: parsed.data.stock ?? product.stock,
    published: parsed.data.published ?? product.published,
  });
  return json({
    product: next,
    warning:
      canPublish || !(parsed.data.published ?? product.published)
        ? undefined
        : "Saved. It will go live after we verify your shop.",
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const { id } = await params;
  const ok = await deleteProduct(id, me);
  if (!ok) return json({ error: "Product not found." }, 404);
  return json({ ok: true });
}
