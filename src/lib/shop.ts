import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { ensureSchema, usingPostgres, withClient } from "@/lib/db/pool";
import { withDb } from "@/lib/store";
import type { PublicProduct, Shop, ShopOrder, ShopOrderItem, ShopProduct, ShopStatus } from "@/lib/shop-shared";
import { slugify } from "@/lib/shop-shared";

export * from "@/lib/shop-shared";

type ShopFile = {
  shops: Shop[];
  products: ShopProduct[];
  orders: ShopOrder[];
};

const FILE = path.join(process.cwd(), "data", "shop.json");
let cache: ShopFile | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function emptyFile(): ShopFile {
  return { shops: [], products: [], orders: [] };
}

async function loadFile(): Promise<ShopFile> {
  if (cache) return cache;
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as ShopFile;
    cache = {
      shops: parsed.shops ?? [],
      products: parsed.products ?? [],
      orders: (parsed.orders ?? []).map((o) => ({ ...o, items: o.items ?? [] })),
    };
  } catch {
    cache = emptyFile();
  }
  return cache;
}

function saveFileSoon() {
  if (!cache) return;
  const snapshot = JSON.stringify(cache, null, 2);
  writeQueue = writeQueue.then(async () => {
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(FILE, snapshot);
  });
}

function textArr(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [];
}

function socialsOf(value: unknown): Shop["socials"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const next: Shop["socials"] = {};
  for (const key of ["instagram", "tiktok", "facebook", "x", "youtube", "whatsapp", "website"] as const) {
    const v = String(raw[key] || "").trim();
    if (v) next[key] = v.slice(0, 200);
  }
  return next;
}

function emptyShop(userId: string, name: string): Shop {
  const now = nowIso();
  return {
    userId,
    status: "off",
    name,
    bio: "",
    category: "",
    location: "",
    sells: "",
    email: "",
    phone: "",
    socials: {},
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeShop(shop: Shop): Shop {
  return {
    ...emptyShop(shop.userId, shop.name || ""),
    ...shop,
    category: shop.category || "",
    location: shop.location || "",
    sells: shop.sells || "",
    email: shop.email || "",
    phone: shop.phone || "",
    socials: socialsOf(shop.socials),
  };
}

function rowShop(row: Record<string, unknown>): Shop {
  const lat = row.location_lat == null ? undefined : Number(row.location_lat);
  const lng = row.location_lng == null ? undefined : Number(row.location_lng);
  return {
    userId: String(row.user_id),
    status: (row.status as ShopStatus) || "off",
    name: String(row.name || ""),
    bio: String(row.bio || ""),
    category: String(row.category || ""),
    logoUrl: row.logo_url ? String(row.logo_url) : undefined,
    location: String(row.location || ""),
    locationLat: Number.isFinite(lat) ? lat : undefined,
    locationLng: Number.isFinite(lng) ? lng : undefined,
    sells: String(row.sells || ""),
    email: String(row.email || ""),
    phone: String(row.phone || ""),
    socials: socialsOf(row.socials),
    submittedAt: row.submitted_at ? new Date(String(row.submitted_at)).toISOString() : undefined,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function rowProduct(row: Record<string, unknown>): ShopProduct {
  return {
    id: String(row.id),
    sellerId: String(row.seller_id),
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description || ""),
    priceCents: Number(row.price_cents) || 0,
    images: textArr(row.images),
    category: String(row.category || "Other"),
    stock: Number(row.stock) || 0,
    published: Boolean(row.published),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function rowItem(row: Record<string, unknown>): ShopOrderItem {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    productId: String(row.product_id),
    sellerId: String(row.seller_id),
    slug: String(row.slug || ""),
    name: String(row.name),
    image: row.image ? String(row.image) : undefined,
    qty: Number(row.qty) || 1,
    priceCents: Number(row.price_cents) || 0,
  };
}

function rowOrder(row: Record<string, unknown>, items: ShopOrderItem[]): ShopOrder {
  return {
    id: String(row.id),
    buyerId: String(row.buyer_id),
    status: (row.status as ShopOrder["status"]) || "placed",
    name: String(row.name || ""),
    phone: String(row.phone || ""),
    address: String(row.address || ""),
    notes: String(row.notes || ""),
    totalCents: Number(row.total_cents) || 0,
    createdAt: new Date(String(row.created_at)).toISOString(),
    items,
  };
}

async function sellerMeta(ids: string[]) {
  const unique = [...new Set(ids)];
  return withDb((db) => {
    const shopsByUser: Record<string, { sellerName: string; shopName: string }> = {};
    for (const id of unique) {
      const user = db.users.find((u) => u.id === id);
      shopsByUser[id] = {
        sellerName: user?.name || "Seller",
        shopName: user?.name || "Shop",
      };
    }
    return shopsByUser;
  });
}

async function attachPublic(products: ShopProduct[]): Promise<PublicProduct[]> {
  if (!products.length) return [];
  const shops = await Promise.all(products.map((p) => getShop(p.sellerId)));
  const meta = await sellerMeta(products.map((p) => p.sellerId));
  return products.map((p, i) => ({
    ...p,
    sellerName: meta[p.sellerId]?.sellerName || "Seller",
    shopName: shops[i]?.name || meta[p.sellerId]?.shopName || "Shop",
  }));
}

export async function getShop(userId: string): Promise<Shop | null> {
  if (usingPostgres()) {
    try {
      await ensureSchema();
      return await withClient(async (client) => {
        const res = await client.query(`SELECT * FROM shops WHERE user_id = $1`, [userId]);
        return res.rows[0] ? rowShop(res.rows[0]) : null;
      });
    } catch {
      /* fall through */
    }
  }
  const file = await loadFile();
  const found = file.shops.find((s) => s.userId === userId);
  return found ? normalizeShop(found) : null;
}

export async function saveShop(shop: Shop): Promise<Shop> {
  shop.updatedAt = nowIso();
  if (usingPostgres()) {
    await ensureSchema();
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO shops (
           user_id, status, name, bio, category, logo_url, location, location_lat, location_lng,
           sells, socials, email, phone, submitted_at, created_at, updated_at
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16)
         ON CONFLICT (user_id) DO UPDATE SET
           status = EXCLUDED.status,
           name = EXCLUDED.name,
           bio = EXCLUDED.bio,
           category = EXCLUDED.category,
           logo_url = EXCLUDED.logo_url,
           location = EXCLUDED.location,
           location_lat = EXCLUDED.location_lat,
           location_lng = EXCLUDED.location_lng,
           sells = EXCLUDED.sells,
           socials = EXCLUDED.socials,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           submitted_at = EXCLUDED.submitted_at,
           updated_at = EXCLUDED.updated_at`,
        [
          shop.userId,
          shop.status,
          shop.name,
          shop.bio,
          shop.category,
          shop.logoUrl || null,
          shop.location,
          shop.locationLat ?? null,
          shop.locationLng ?? null,
          shop.sells,
          JSON.stringify(shop.socials || {}),
          shop.email,
          shop.phone,
          shop.submittedAt || null,
          shop.createdAt,
          shop.updatedAt,
        ],
      );
    });
    return shop;
  }
  const file = await loadFile();
  const i = file.shops.findIndex((s) => s.userId === shop.userId);
  if (i >= 0) file.shops[i] = shop;
  else file.shops.push(shop);
  saveFileSoon();
  return shop;
}

export async function activateShop(userId: string, enabled: boolean): Promise<Shop> {
  const user = await withDb((db) => db.users.find((u) => u.id === userId));
  const existing = await getShop(userId);
  const now = nowIso();
  const base = existing || emptyShop(userId, user?.name || "");
  if (!enabled) {
    return saveShop({ ...base, status: "off", updatedAt: now });
  }
  if (base.status === "verified" || base.status === "pending") {
    return saveShop({ ...base, status: base.status, updatedAt: now });
  }
  return saveShop({ ...base, status: "setup", name: base.name || user?.name || "", updatedAt: now });
}

export type ShopPatch = {
  name?: string;
  bio?: string;
  category?: string;
  logoUrl?: string | null;
  location?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  sells?: string;
  email?: string;
  phone?: string;
  socials?: Shop["socials"];
};

export async function updateShopSettings(userId: string, patch: ShopPatch): Promise<Shop | null> {
  const existing = await getShop(userId);
  if (!existing || existing.status === "off") return null;
  return saveShop({
    ...existing,
    name: patch.name !== undefined ? patch.name.trim().slice(0, 80) : existing.name,
    bio: patch.bio !== undefined ? patch.bio.trim().slice(0, 400) : existing.bio,
    category: patch.category !== undefined ? patch.category.trim().slice(0, 40) : existing.category,
    logoUrl: patch.logoUrl === null ? undefined : patch.logoUrl !== undefined ? patch.logoUrl : existing.logoUrl,
    location: patch.location !== undefined ? patch.location.trim().slice(0, 160) : existing.location,
    locationLat: patch.locationLat === null ? undefined : patch.locationLat !== undefined ? patch.locationLat : existing.locationLat,
    locationLng: patch.locationLng === null ? undefined : patch.locationLng !== undefined ? patch.locationLng : existing.locationLng,
    sells: patch.sells !== undefined ? patch.sells.trim().slice(0, 400) : existing.sells,
    email: patch.email !== undefined ? patch.email.trim().slice(0, 120) : existing.email,
    phone: patch.phone !== undefined ? patch.phone.trim().slice(0, 40) : existing.phone,
    socials: patch.socials !== undefined ? socialsOf(patch.socials) : existing.socials,
  });
}

export async function submitShop(userId: string): Promise<Shop | null> {
  const existing = await getShop(userId);
  if (!existing || existing.status === "off") return null;
  if (existing.name.trim().length < 2) return null;
  if (!existing.category.trim()) return null;
  if (!existing.logoUrl) return null;
  if (!existing.location.trim()) return null;
  if (!existing.sells.trim()) return null;
  if (!existing.email.includes("@")) return null;
  if (existing.phone.replace(/\D/g, "").length < 7) return null;
  return saveShop({
    ...existing,
    status: existing.status === "verified" ? "verified" : "pending",
    submittedAt: nowIso(),
  });
}

export async function listShops(status?: ShopStatus | "all"): Promise<Shop[]> {
  const filter = !status || status === "all" ? null : status;
  if (usingPostgres()) {
    await ensureSchema();
    return withClient(async (client) => {
      const res = filter
        ? await client.query(
            `SELECT * FROM shops WHERE status = $1 ORDER BY COALESCE(submitted_at, updated_at) DESC`,
            [filter],
          )
        : await client.query(`SELECT * FROM shops ORDER BY COALESCE(submitted_at, updated_at) DESC`);
      return res.rows.map(rowShop);
    });
  }
  const rows = (await loadFile()).shops.map(normalizeShop);
  const filtered = filter ? rows.filter((s) => s.status === filter) : rows;
  return filtered.sort(
    (a, b) => +new Date(b.submittedAt || b.updatedAt) - +new Date(a.submittedAt || a.updatedAt),
  );
}

export async function reviewShop(userId: string, status: "verified" | "rejected"): Promise<Shop | null> {
  const existing = await getShop(userId);
  if (!existing) return null;
  if (existing.status === "off" || existing.status === "setup") return null;
  return saveShop({ ...existing, status });
}

export async function shopCounts() {
  const shops = await listShops("all");
  return {
    pending: shops.filter((s) => s.status === "pending").length,
    verified: shops.filter((s) => s.status === "verified").length,
    rejected: shops.filter((s) => s.status === "rejected").length,
    setup: shops.filter((s) => s.status === "setup").length,
    total: shops.length,
  };
}

async function allProducts(): Promise<ShopProduct[]> {
  if (usingPostgres()) {
    await ensureSchema();
    return withClient(async (client) => {
      const res = await client.query(`SELECT * FROM shop_products ORDER BY created_at DESC`);
      return res.rows.map(rowProduct);
    });
  }
  return (await loadFile()).products;
}

export async function listAllProducts() {
  return allProducts();
}

export async function getProduct(id: string): Promise<ShopProduct | null> {
  if (usingPostgres()) {
    await ensureSchema();
    return withClient(async (client) => {
      const res = await client.query(`SELECT * FROM shop_products WHERE id = $1`, [id]);
      return res.rows[0] ? rowProduct(res.rows[0]) : null;
    });
  }
  return (await loadFile()).products.find((p) => p.id === id) || null;
}

export async function getProductBySlug(slug: string): Promise<ShopProduct | null> {
  if (usingPostgres()) {
    await ensureSchema();
    return withClient(async (client) => {
      const res = await client.query(`SELECT * FROM shop_products WHERE slug = $1`, [slug]);
      return res.rows[0] ? rowProduct(res.rows[0]) : null;
    });
  }
  return (await loadFile()).products.find((p) => p.slug === slug) || null;
}

async function verifiedSellerIds() {
  if (usingPostgres()) {
    await ensureSchema();
    return withClient(async (client) => {
      const res = await client.query(`SELECT user_id FROM shops WHERE status = 'verified'`);
      return new Set(res.rows.map((r) => String(r.user_id)));
    });
  }
  return new Set((await loadFile()).shops.filter((s) => s.status === "verified").map((s) => s.userId));
}

export async function listPublicProducts(opts?: {
  category?: string;
  sellerId?: string;
}): Promise<PublicProduct[]> {
  const verified = await verifiedSellerIds();
  let products = (await allProducts()).filter(
    (p) => p.published && verified.has(p.sellerId) && (!opts?.sellerId || p.sellerId === opts.sellerId),
  );
  if (opts?.category) products = products.filter((p) => p.category === opts.category);
  return attachPublic(products);
}

export async function getPublicProductBySlug(slug: string): Promise<PublicProduct | null> {
  const product = await getProductBySlug(slug);
  if (!product || !product.published) return null;
  const shop = await getShop(product.sellerId);
  if (shop?.status !== "verified") return null;
  const [pub] = await attachPublic([product]);
  return pub || null;
}

export async function listRelated(product: ShopProduct, limit = 8): Promise<PublicProduct[]> {
  const all = await listPublicProducts();
  return all.filter((p) => p.id !== product.id && (p.category === product.category || p.sellerId === product.sellerId)).slice(0, limit);
}

export async function listSellerProducts(sellerId: string): Promise<ShopProduct[]> {
  return (await allProducts()).filter((p) => p.sellerId === sellerId);
}

export async function uniqueSlug(name: string, excludeId?: string) {
  const base = slugify(name);
  const products = await allProducts();
  let slug = base;
  let n = 2;
  while (products.some((p) => p.slug === slug && p.id !== excludeId)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export async function saveProduct(product: ShopProduct): Promise<ShopProduct> {
  if (usingPostgres()) {
    await ensureSchema();
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO shop_products
           (id, seller_id, slug, name, description, price_cents, images, category, stock, published, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET
           slug = EXCLUDED.slug,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price_cents = EXCLUDED.price_cents,
           images = EXCLUDED.images,
           category = EXCLUDED.category,
           stock = EXCLUDED.stock,
           published = EXCLUDED.published`,
        [
          product.id,
          product.sellerId,
          product.slug,
          product.name,
          product.description,
          product.priceCents,
          product.images,
          product.category,
          product.stock,
          product.published,
          product.createdAt,
        ],
      );
    });
    return product;
  }
  const file = await loadFile();
  const i = file.products.findIndex((p) => p.id === product.id);
  if (i >= 0) file.products[i] = product;
  else file.products.unshift(product);
  saveFileSoon();
  return product;
}

export async function deleteProduct(id: string, sellerId: string): Promise<boolean> {
  const product = await getProduct(id);
  if (!product || product.sellerId !== sellerId) return false;
  if (usingPostgres()) {
    await ensureSchema();
    await withClient(async (client) => {
      await client.query(`DELETE FROM shop_products WHERE id = $1 AND seller_id = $2`, [id, sellerId]);
    });
    return true;
  }
  const file = await loadFile();
  file.products = file.products.filter((p) => p.id !== id);
  saveFileSoon();
  return true;
}

export type CheckoutItem = { productId: string; quantity: number };

export async function createOrder(input: {
  buyerId: string;
  name: string;
  phone: string;
  address: string;
  notes?: string;
  items: CheckoutItem[];
}): Promise<ShopOrder> {
  if (!input.items.length) throw new Error("Your cart is empty.");
  const lines: { product: ShopProduct; qty: number }[] = [];
  for (const item of input.items) {
    const product = await getProduct(item.productId);
    const qty = Math.max(1, Math.min(99, Math.floor(item.quantity || 1)));
    if (!product || !product.published) throw new Error("A product in your cart is no longer available.");
    const shop = await getShop(product.sellerId);
    if (shop?.status !== "verified") throw new Error("A seller in your cart is not selling right now.");
    if (product.stock < qty) throw new Error(`${product.name} does not have enough stock.`);
    lines.push({ product, qty });
  }

  const orderId = `ord_${crypto.randomUUID().slice(0, 12)}`;
  const createdAt = nowIso();
  const items: ShopOrderItem[] = lines.map((line) => ({
    id: `oi_${crypto.randomUUID().slice(0, 12)}`,
    orderId,
    productId: line.product.id,
    sellerId: line.product.sellerId,
    slug: line.product.slug,
    name: line.product.name,
    image: line.product.images[0],
    qty: line.qty,
    priceCents: line.product.priceCents,
  }));
  const order: ShopOrder = {
    id: orderId,
    buyerId: input.buyerId,
    status: "placed",
    name: input.name.trim().slice(0, 80),
    phone: input.phone.trim().slice(0, 40),
    address: input.address.trim().slice(0, 240),
    notes: (input.notes || "").trim().slice(0, 400),
    totalCents: items.reduce((n, i) => n + i.priceCents * i.qty, 0),
    createdAt,
    items,
  };

  for (const line of lines) {
    await saveProduct({ ...line.product, stock: line.product.stock - line.qty });
  }

  if (usingPostgres()) {
    await ensureSchema();
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO shop_orders (id, buyer_id, status, name, phone, address, notes, total_cents, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          order.id,
          order.buyerId,
          order.status,
          order.name,
          order.phone,
          order.address,
          order.notes,
          order.totalCents,
          order.createdAt,
        ],
      );
      for (const item of items) {
        await client.query(
          `INSERT INTO shop_order_items
             (id, order_id, product_id, seller_id, slug, name, image, qty, price_cents)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            item.id,
            item.orderId,
            item.productId,
            item.sellerId,
            item.slug,
            item.name,
            item.image || null,
            item.qty,
            item.priceCents,
          ],
        );
      }
    });
    return order;
  }

  const file = await loadFile();
  file.orders.unshift(order);
  saveFileSoon();
  return order;
}

async function hydrateOrders(orders: Omit<ShopOrder, "items">[] | ShopOrder[]): Promise<ShopOrder[]> {
  if (!orders.length) return [];
  if (!usingPostgres()) {
    const file = await loadFile();
    return orders.map((o) => file.orders.find((x) => x.id === o.id)!).filter(Boolean);
  }
  return withClient(async (client) => {
    const ids = orders.map((o) => o.id);
    const res = await client.query(`SELECT * FROM shop_order_items WHERE order_id = ANY($1::text[])`, [ids]);
    const byOrder = new Map<string, ShopOrderItem[]>();
    for (const row of res.rows) {
      const item = rowItem(row);
      const list = byOrder.get(item.orderId) ?? [];
      list.push(item);
      byOrder.set(item.orderId, list);
    }
    return orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }));
  });
}

export async function listBuyerOrders(buyerId: string): Promise<ShopOrder[]> {
  if (usingPostgres()) {
    await ensureSchema();
    const rows = await withClient(async (client) => {
      const res = await client.query(`SELECT * FROM shop_orders WHERE buyer_id = $1 ORDER BY created_at DESC`, [buyerId]);
      return res.rows.map((r) => rowOrder(r, []));
    });
    return hydrateOrders(rows);
  }
  return (await loadFile()).orders.filter((o) => o.buyerId === buyerId);
}

export async function listSellerOrders(sellerId: string): Promise<ShopOrder[]> {
  if (usingPostgres()) {
    await ensureSchema();
    const rows = await withClient(async (client) => {
      const res = await client.query(
        `SELECT DISTINCT o.*
         FROM shop_orders o
         JOIN shop_order_items i ON i.order_id = o.id
         WHERE i.seller_id = $1
         ORDER BY o.created_at DESC`,
        [sellerId],
      );
      return res.rows.map((r) => rowOrder(r, []));
    });
    const hydrated = await hydrateOrders(rows);
    return hydrated.map((o) => ({ ...o, items: o.items.filter((i) => i.sellerId === sellerId) }));
  }
  return (await loadFile()).orders
    .map((o) => ({ ...o, items: o.items.filter((i) => i.sellerId === sellerId) }))
    .filter((o) => o.items.length);
}

export async function listAllOrders(): Promise<ShopOrder[]> {
  if (usingPostgres()) {
    await ensureSchema();
    const rows = await withClient(async (client) => {
      const res = await client.query(`SELECT * FROM shop_orders ORDER BY created_at DESC LIMIT 200`);
      return res.rows.map((r) => rowOrder(r, []));
    });
    return hydrateOrders(rows);
  }
  return (await loadFile()).orders.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export async function setProductPublished(id: string, published: boolean) {
  const product = await getProduct(id);
  if (!product) return null;
  return saveProduct({ ...product, published });
}
