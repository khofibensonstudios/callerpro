import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/SiteChrome";
import { ShopView } from "@/components/shop/ShopView";
import { getShop } from "@/lib/shop";
import { withDb } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SellerShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shop = await getShop(id);
  if (!shop || shop.status !== "verified") notFound();
  const seller = await withDb((db) => db.users.find((u) => u.id === id));
  return (
    <SiteChrome variant="wide">
      <ShopView sellerId={id} sellerName={shop.name || seller?.name || "Shop"} />
    </SiteChrome>
  );
}
