"use client";

import { useEffect, useState } from "react";
import { SiteChrome } from "@/components/SiteChrome";
import { SellerNav } from "@/components/shop/SellerNav";
import { formatMoney, type ShopOrder } from "@/lib/shop-shared";

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/shop/orders?as=seller", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setOrders(Array.isArray(d.orders) ? d.orders : []))
      .finally(() => setReady(true));
  }, []);

  return (
    <SiteChrome variant="wide">
      <div className="bg-white px-4 py-8 md:px-10 md:py-10">
        <p className="text-[10px] font-semibold tracking-[0.22em] text-[#e85d04] uppercase">Seller</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Orders</h1>
        <div className="mt-6">
          <SellerNav />
        </div>
        {!ready ? (
          <p className="mt-8 text-sm text-[#6f6a64]">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="mt-10 text-sm text-[#6f6a64]">No orders yet.</p>
        ) : (
          <ul className="mt-8 space-y-4">
            {orders.map((o) => (
              <li key={o.id} className="border border-black/[0.08] p-5">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-semibold">{o.name}</p>
                  <p className="tabular-nums">{formatMoney(o.items.reduce((n, i) => n + i.priceCents * i.qty, 0))}</p>
                </div>
                <p className="mt-1 text-sm text-[#6f6a64]">
                  {o.phone} · {o.address}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {o.items.map((i) => (
                    <li key={i.id}>
                      {i.name} × {i.qty}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SiteChrome>
  );
}
