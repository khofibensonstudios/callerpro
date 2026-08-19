"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteChrome } from "@/components/SiteChrome";
import { SellerNav } from "@/components/shop/SellerNav";
import { formatMoney, type ShopProduct } from "@/lib/shop-shared";

export default function SellerProductsPage() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/shop/mine/products", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d.products) ? d.products : []))
      .finally(() => setReady(true));
  }, []);

  async function remove(id: string) {
    if (!confirm("Remove this product?")) return;
    const res = await fetch(`/api/shop/mine/products/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <SiteChrome variant="wide">
      <div className="bg-white px-4 py-8 md:px-10 md:py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.22em] text-[#e85d04] uppercase">Seller</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Products</h1>
          </div>
          <Link
            href="/shop/manage/products/new"
            className="bg-[#141414] px-4 py-2.5 text-[11px] font-semibold tracking-[0.12em] text-white uppercase"
          >
            Upload
          </Link>
        </div>
        <div className="mt-6">
          <SellerNav />
        </div>
        {!ready ? (
          <p className="mt-8 text-sm text-[#6f6a64]">Loading…</p>
        ) : products.length === 0 ? (
          <p className="mt-10 text-sm text-[#6f6a64]">No products yet. Upload your first item.</p>
        ) : (
          <ul className="mt-8 divide-y divide-black/[0.06]">
            {products.map((p) => (
              <li key={p.id} className="flex items-center gap-4 py-4">
                <div className="h-16 w-14 shrink-0 overflow-hidden bg-[#ebe6de]">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-sm text-[#6f6a64]">
                    {formatMoney(p.priceCents)} · {p.published ? "Listed" : "Draft"} · {p.stock} in stock
                  </p>
                </div>
                <Link href={`/shop/manage/products/${p.id}`} className="text-sm font-semibold">
                  Edit
                </Link>
                <button type="button" onClick={() => void remove(p.id)} className="text-sm text-[#6f6a64]">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SiteChrome>
  );
}
