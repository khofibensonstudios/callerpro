import { notFound } from "next/navigation";
import { FlagButton, ProductButtons, ShopReviewButtons } from "@/components/ops/OpsActions";
import { OpsTitle } from "@/components/ops/OpsShell";
import { OpsAvatar, OpsBadge, OpsKicker, OpsPanel, statusTone } from "@/components/ops/OpsUi";
import { opsHref } from "@/lib/ops-path";
import { getShop, listSellerProducts } from "@/lib/shop";
import { formatMoney, SHOP_SOCIALS } from "@/lib/shop-shared";
import { withDb } from "@/lib/store";
import { defaultPortrait } from "@/lib/constants";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="border-b border-white/8 py-3 last:border-0">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-[#9c968c] uppercase">{label}</p>
      <p className="mt-1 break-words text-[15px] font-medium">{value}</p>
    </div>
  );
}

export default async function OpsShopDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const shop = await getShop(userId);
  if (!shop) notFound();
  const [seller, products] = await Promise.all([
    withDb((db) => db.users.find((u) => u.id === userId)),
    listSellerProducts(userId),
  ]);
  const socials = SHOP_SOCIALS.map((row) => ({ ...row, url: shop.socials[row.id] })).filter((row) => row.url);
  const map =
    shop.locationLat != null && shop.locationLng != null
      ? `https://www.google.com/maps?q=${shop.locationLat},${shop.locationLng}`
      : null;

  return (
    <>
      <OpsTitle
        kicker="Storefront"
        title={shop.name || "Shop"}
        extra={
          seller ? (
            <a href={opsHref(`/people/${seller.id}`)} className="ops-btn">
              Seller dossier
            </a>
          ) : null
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <OpsPanel>
          <div className="flex items-start gap-4">
            {shop.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.logoUrl} alt="" className="h-20 w-20 rounded-2xl object-cover" />
            ) : (
              <OpsAvatar src={seller?.avatarUrl || defaultPortrait(userId)} name={seller?.name || "Shop"} size={80} />
            )}
            <div>
              <OpsBadge tone={statusTone(shop.status)}>{shop.status}</OpsBadge>
              <p className="mt-2 text-sm text-[#9c968c]">
                {seller?.name || "Unknown"}
                {seller?.email ? ` · ${seller.email}` : ""}
              </p>
              {shop.bio ? <p className="mt-3 text-sm leading-6">{shop.bio}</p> : null}
            </div>
          </div>
          <div className="mt-6">
            <Row label="Category" value={shop.category} />
            <Row label="Sells" value={shop.sells} />
            <Row label="Location" value={shop.location} />
            <Row label="Email" value={shop.email} />
            <Row label="Phone" value={shop.phone} />
          </div>
          {map ? (
            <a href={map} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-[#e85d04]">
              Open map
            </a>
          ) : null}
          {socials.length ? (
            <ul className="mt-4 space-y-1">
              {socials.map((row) => (
                <li key={row.id}>
                  <a href={row.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#e85d04]">
                    {row.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4">
            <FlagButton type="shop" id={shop.userId} />
          </div>
          <ShopReviewButtons userId={shop.userId} status={shop.status} nextHref={opsHref("/shops")} />
        </OpsPanel>
        <OpsPanel>
          <OpsKicker>Catalog</OpsKicker>
          <p className="mt-1 text-lg font-bold">{products.length} products</p>
          <ul className="mt-4 space-y-3">
            {products.length === 0 ? <p className="text-sm text-[#9c968c]">No products yet.</p> : null}
            {products.map((p) => (
              <li key={p.id} className="rounded-2xl bg-[#1d1a16] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="mt-1 text-sm text-[#9c968c]">
                      {formatMoney(p.priceCents)} · stock {p.stock} · {p.published ? "live" : "draft"}
                    </p>
                  </div>
                  <ProductButtons id={p.id} published={p.published} />
                </div>
              </li>
            ))}
          </ul>
        </OpsPanel>
      </div>
    </>
  );
}
