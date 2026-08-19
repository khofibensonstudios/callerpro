import { OpsTitle } from "@/components/ops/OpsShell";
import { OpsAvatar, OpsBadge, OpsEmpty, OpsTable, statusTone } from "@/components/ops/OpsUi";
import { opsCommerceDesk, opsShopRows } from "@/lib/ops-data";
import type { ShopStatus } from "@/lib/shop-shared";
import { formatMoney } from "@/lib/shop-shared";
import { opsHref } from "@/lib/ops-path";
import { timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

const TABS: { id: "pending" | "verified" | "rejected" | "all"; label: string }[] = [
  { id: "pending", label: "Applications" },
  { id: "verified", label: "Verified" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

function isStatus(value: string | undefined): value is ShopStatus | "all" {
  return value === "pending" || value === "verified" || value === "rejected" || value === "all" || value === "setup" || value === "off";
}

export default async function OpsShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: raw } = await searchParams;
  const status = isStatus(raw) ? raw : "pending";
  const [rows, desk] = await Promise.all([opsShopRows(status === "all" ? "all" : status), opsCommerceDesk()]);

  return (
    <>
      <OpsTitle
        title="Shops"
        extra={<p className="ops-muted text-sm">{desk.counts.pending} waiting · {formatMoney(desk.gmv)} GMV</p>}
      />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <a key={tab.id} href={opsHref(`/shops?status=${tab.id}`)} className={`ops-chip ${status === tab.id ? "ops-chip-on" : ""}`}>
            {tab.label}
          </a>
        ))}
      </div>
      {rows.length === 0 ? (
        <OpsEmpty title="Nothing in this list" body="Applications land here when a seller submits a shop." />
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <th>Shop</th>
              <th>Seller</th>
              <th>Status</th>
              <th>Category</th>
              <th>Products</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((shop) => (
              <tr key={shop.userId}>
                <td>
                  <a href={opsHref(`/shops/${shop.userId}`)} className="flex items-center gap-3 font-semibold">
                    <OpsAvatar src={shop.logoUrl || shop.sellerAvatar} name={shop.name || shop.sellerName} />
                    {shop.name || "Untitled shop"}
                  </a>
                </td>
                <td>
                  <a href={opsHref(`/people/${shop.userId}`)}>{shop.sellerName}</a>
                </td>
                <td>
                  <OpsBadge tone={statusTone(shop.status)}>{shop.status}</OpsBadge>
                </td>
                <td className="ops-muted">{shop.category || "—"}</td>
                <td>
                  {shop.liveProducts}/{shop.productCount}
                </td>
                <td className="ops-muted">{shop.submittedAt ? timeAgo(shop.submittedAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </OpsTable>
      )}
    </>
  );
}
