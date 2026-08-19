import { OpsTitle } from "@/components/ops/OpsShell";
import { OpsBadge, OpsEmpty, OpsTable } from "@/components/ops/OpsUi";
import { opsHref } from "@/lib/ops-path";
import { listAllOrders } from "@/lib/shop";
import { formatMoney } from "@/lib/shop-shared";
import { withDb } from "@/lib/store";
import { timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function OpsOrdersPage() {
  const orders = await listAllOrders();
  const names = await withDb((db) => Object.fromEntries(db.users.map((u) => [u.id, u.name])));
  return (
    <>
      <OpsTitle title="Orders" extra={<p className="ops-muted text-sm">{orders.length} captured</p>} />
      {orders.length === 0 ? (
        <OpsEmpty title="No orders" body="Checkout tickets land here." />
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <th>Total</th>
              <th>Status</th>
              <th>Buyer</th>
              <th>Items</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="font-semibold">{formatMoney(o.totalCents)}</td>
                <td>
                  <OpsBadge>{o.status}</OpsBadge>
                </td>
                <td>
                  <a href={opsHref(`/people/${o.buyerId}`)}>{names[o.buyerId] || o.buyerId}</a>
                  {o.phone ? <span className="ops-muted"> · {o.phone}</span> : null}
                </td>
                <td className="ops-muted max-w-xs truncate">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</td>
                <td className="ops-muted">{timeAgo(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </OpsTable>
      )}
    </>
  );
}
