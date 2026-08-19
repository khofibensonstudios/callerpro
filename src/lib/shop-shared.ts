export const SHOP_CATEGORIES = ["Fashion", "Beauty", "Electronics", "Home", "Food", "Sports", "Other"] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export type ShopStatus = "off" | "setup" | "pending" | "verified" | "rejected";

export type ShopSocials = {
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  x?: string;
  youtube?: string;
  whatsapp?: string;
  website?: string;
};

export const SHOP_SOCIALS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
  { id: "x", label: "X" },
  { id: "youtube", label: "YouTube" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "website", label: "Website" },
] as const;

export type Shop = {
  userId: string;
  status: ShopStatus;
  name: string;
  bio: string;
  category: string;
  logoUrl?: string;
  location: string;
  locationLat?: number;
  locationLng?: number;
  sells: string;
  email: string;
  phone: string;
  socials: ShopSocials;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ShopProduct = {
  id: string;
  sellerId: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  images: string[];
  category: string;
  stock: number;
  published: boolean;
  createdAt: string;
};

export type PublicProduct = ShopProduct & {
  sellerName: string;
  shopName: string;
};

export type ShopOrderItem = {
  id: string;
  orderId: string;
  productId: string;
  sellerId: string;
  slug: string;
  name: string;
  image?: string;
  qty: number;
  priceCents: number;
};

export type ShopOrder = {
  id: string;
  buyerId: string;
  status: "placed" | "paid" | "cancelled";
  name: string;
  phone: string;
  address: string;
  notes: string;
  totalCents: number;
  createdAt: string;
  items: ShopOrderItem[];
};

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
}

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "item";
}
