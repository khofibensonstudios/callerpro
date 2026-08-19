"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SiteChrome } from "@/components/SiteChrome";
import { SellerNav } from "@/components/shop/SellerNav";
import { ProductForm } from "@/components/shop/ProductForm";
import type { ShopProduct } from "@/lib/shop-shared";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ShopProduct | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/shop/mine/products", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const found = (d.products as ShopProduct[] | undefined)?.find((p) => p.id === id);
        setProduct(found || null);
      });
  }, [id]);

  if (product === undefined) {
    return (
      <SiteChrome variant="wide">
        <p className="p-8 text-sm text-[#6f6a64]">Loading…</p>
      </SiteChrome>
    );
  }
  if (!product) {
    return (
      <SiteChrome variant="wide">
        <p className="p-8 text-sm text-[#6f6a64]">Product not found.</p>
      </SiteChrome>
    );
  }

  return (
    <SiteChrome variant="wide">
      <div className="bg-white px-4 py-8 md:px-10 md:py-10">
        <p className="text-[10px] font-semibold tracking-[0.22em] text-[#e85d04] uppercase">Seller</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Edit product</h1>
        <div className="mt-6">
          <SellerNav />
        </div>
        <div className="mt-10">
          <ProductForm product={product} />
        </div>
      </div>
    </SiteChrome>
  );
}
