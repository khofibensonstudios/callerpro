"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SiteChrome } from "@/components/SiteChrome";
import { formatMoney, type ShopOrder } from "@/lib/shop-shared";

export default function BuyerOrdersPage() {
  return (
    <Suspense
      fallback={
        <SiteChrome variant="wide">
          <p className="p-8 text-sm text-[#6f6a64]">Loading…</p>
        </SiteChrome>
      }
    >
      <BuyerOrdersInner />
    </Suspense>
  );
}

function BuyerOrdersInner() {
  const placed = useSearchParams().get("placed");
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/shop/orders", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setOrders(Array.isArray(d.orders) ? d.orders : []))
      .finally(() => setReady(true));
  }, []);

  return (
    <SiteChrome variant="wide">
      <div className="px-4 py-8 md:px-8">
        <p className="text-[11px] font-bold tracking-[0.22em] text-[#e85d04] uppercase">Orders</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Your purchases</h1>
        {placed ? <p className="mt-3 text-sm text-emerald-700">Order placed. We’ll follow up on delivery.</p> : null}
        {!ready ? (
          <p className="mt-8 text-sm text-[#6f6a64]">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="mt-8 text-sm text-[#6f6a64]">
            No orders yet. <Link href="/shop" className="underline">Browse the shop</Link>
          </p>
        ) : (
          <ul className="mt-8 space-y-4">
            {orders.map((o) => (
              <li key={o.id} className="bg-white p-5 ring-1 ring-black/[0.06]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{o.id}</p>
                  <p className="text-sm tabular-nums">{formatMoney(o.totalCents)}</p>
                </div>
                <p className="mt-1 text-xs tracking-wide text-[#6f6a64] uppercase">{o.status}</p>
                <ul className="mt-3 space-y-1 text-sm text-[#6f6a64]">
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
