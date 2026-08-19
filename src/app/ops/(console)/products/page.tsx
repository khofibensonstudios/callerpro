import { ProductButtons } from "@/components/ops/OpsActions";
import { OpsTitle } from "@/components/ops/OpsShell";
import { OpsBadge, OpsEmpty, OpsTable } from "@/components/ops/OpsUi";
import { opsHref } from "@/lib/ops-path";
import { listAllProducts } from "@/lib/shop";
import { formatMoney } from "@/lib/shop-shared";
import { withDb } from "@/lib/store";
import { timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function OpsProductsPage() {
  const products = await listAllProducts();
  const names = await withDb((db) => Object.fromEntries(db.users.map((u) => [u.id, u.name])));
  return (
    <>
      <OpsTitle title="Products" extra={<p className="ops-muted text-sm">{products.length} in catalog</p>} />
      {products.length === 0 ? (
        <OpsEmpty title="No products" body="Items appear when shops publish." />
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <th>Product</th>
              <th>Shop</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">{p.name}</td>
                <td>
                  <a href={opsHref(`/shops/${p.sellerId}`)}>{names[p.sellerId] || p.sellerId}</a>
                </td>
                <td>{formatMoney(p.priceCents)}</td>
                <td>{p.stock}</td>
                <td>
                  <OpsBadge tone={p.published ? "ok" : "mute"}>{p.published ? "Live" : "Draft"}</OpsBadge>
                </td>
                <td className="ops-muted">{timeAgo(p.createdAt)}</td>
                <td>
                  <ProductButtons id={p.id} published={p.published} />
                </td>
              </tr>
            ))}
          </tbody>
        </OpsTable>
      )}
    </>
  );
}
