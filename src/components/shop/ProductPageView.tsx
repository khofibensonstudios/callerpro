"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, type PublicProduct } from "@/lib/shop-shared";
import { useCart } from "./CartProvider";
import { ProductGrid } from "./ProductGrid";

export function ProductPageView({
  product,
  related,
}: {
  product: PublicProduct;
  related: PublicProduct[];
}) {
  const { addItem } = useCart();
  const router = useRouter();
  const images = product.images.length ? product.images : [];
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const [copied, setCopied] = useState(false);
  const [descOpen, setDescOpen] = useState(true);
  const [addedFlash, setAddedFlash] = useState(false);
  const inStock = product.stock > 0;
  const total = product.priceCents * qty;
  const photo = images[active] || images[0];

  useEffect(() => {
    setActive(0);
    setQty(1);
    setCopied(false);
    setAddedFlash(false);
    window.scrollTo(0, 0);
  }, [product.id]);

  function addToCart() {
    addItem(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        priceCents: product.priceCents,
        image: product.images[0],
      },
      qty,
    );
    setAddedFlash(true);
    window.setTimeout(() => setAddedFlash(false), 1400);
  }

  function buyNow() {
    addToCart();
    router.push("/shop/checkout");
  }

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: product.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="bg-[#f4f1eb] pb-28 md:pb-8">
      <div className="relative md:hidden">
        <div className="relative aspect-[4/5] w-full bg-[#ebe6de]">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={product.name} className="h-full w-full object-contain p-6" />
          ) : null}
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3 pt-3">
            <Link
              href="/shop"
              className="grid h-11 w-11 place-items-center bg-white/95 text-[#141414] shadow-sm backdrop-blur-sm"
              aria-label="Back to shop"
            >
              ←
            </Link>
            <button
              type="button"
              onClick={() => void share()}
              className="grid h-11 w-11 place-items-center bg-white/95 text-[#141414] shadow-sm backdrop-blur-sm"
              aria-label="Share"
            >
              {copied ? "✓" : "↗"}
            </button>
          </div>
          {images.length > 1 ? (
            <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={`${product.id}-dot-${i}`}
                  type="button"
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => setActive(i)}
                  className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-[#141414]" : "w-1.5 bg-[#141414]/30"}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-6xl md:px-4 md:py-8">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="hidden overflow-hidden bg-white md:block md:rounded-3xl md:p-4 md:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <div className="flex gap-3">
              {images.length > 1 ? (
                <div className="hidden w-20 shrink-0 flex-col gap-2 md:flex">
                  {images.slice(0, 8).map((img, i) => (
                    <button
                      key={`${product.id}-${img}`}
                      type="button"
                      onClick={() => setActive(i)}
                      className={`relative aspect-square overflow-hidden rounded-xl bg-[#ebe6de] ${
                        i === active ? "ring-2 ring-black ring-offset-2" : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="relative aspect-square w-full flex-1 bg-[#ebe6de] md:min-h-[480px] md:rounded-2xl">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt={product.name} className="h-full w-full object-cover" />
                ) : null}
                <Link
                  href="/shop"
                  className="absolute top-4 left-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-lg shadow-sm backdrop-blur"
                  aria-label="Back to shop"
                >
                  ←
                </Link>
                {images.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="absolute top-1/2 left-2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-lg shadow-sm"
                      aria-label="Previous photo"
                      onClick={() => setActive((i) => (i - 1 + images.length) % images.length)}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="absolute top-1/2 right-2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-lg shadow-sm"
                      aria-label="Next photo"
                      onClick={() => setActive((i) => (i + 1) % images.length)}
                    >
                      ›
                    </button>
                    <span className="absolute right-3 bottom-3 z-10 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white">
                      {active + 1}/{images.length}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="bg-white px-4 pt-5 pb-2 md:rounded-3xl md:p-7 md:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <Link
              href={`/shop/u/${product.sellerId}`}
              className="text-[11px] font-semibold tracking-[0.18em] text-[#6f6a64] uppercase"
            >
              {product.shopName}
            </Link>
            <h1 className="mt-1.5 text-[1.55rem] leading-[1.15] font-semibold tracking-tight text-[#141414] md:text-[1.75rem] md:font-bold">
              {product.name}
            </h1>
            <p className="mt-4 text-[1.65rem] font-bold tabular-nums md:text-3xl">{formatMoney(product.priceCents)}</p>
            <p className={`mt-3 text-[12px] font-medium ${inStock ? "text-emerald-700" : "text-[#6f6a64]"}`}>
              {inStock ? "In stock · ready to deliver" : "Currently unavailable"}
            </p>

            <div className="mt-6 flex items-center justify-between gap-4 md:hidden">
              <span className="text-[12px] font-semibold tracking-[0.14em] text-[#6f6a64] uppercase">Qty</span>
              <Qty value={qty} set={setQty} />
            </div>

            <div className="mt-6 hidden md:block">
              <p className="text-sm font-semibold">
                Quantity <span className="font-normal text-[#6f6a64]">{qty}</span>
              </p>
              <div className="mt-2">
                <Qty value={qty} set={setQty} rounded />
              </div>
            </div>

            <div className="mt-6 hidden flex-col gap-3 sm:flex-row md:flex">
              <button
                type="button"
                disabled={!inStock}
                onClick={addToCart}
                className="flex-1 border border-black py-3.5 text-sm font-semibold disabled:opacity-40"
              >
                {addedFlash ? "Added" : "Add to cart"}
              </button>
              <button
                type="button"
                disabled={!inStock}
                onClick={buyNow}
                className="flex-1 bg-black py-3.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                Buy now
              </button>
            </div>
          </div>
        </div>

        <section className="mt-2 border-t border-black/[0.08] bg-white md:mt-4 md:rounded-3xl md:border-0 md:p-6 md:shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-4 text-left md:pointer-events-none md:px-0 md:py-0"
            onClick={() => setDescOpen((o) => !o)}
            aria-expanded={descOpen}
          >
            <h2 className="text-base font-bold md:text-lg">Description</h2>
            <span className="text-lg text-[#6f6a64] md:hidden">{descOpen ? "−" : "+"}</span>
          </button>
          <div className={`px-4 pb-5 md:mt-3 md:block md:px-0 md:pb-0 ${descOpen ? "block" : "hidden"}`}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#6f6a64]">
              {product.description || "No description yet."}
            </p>
          </div>
        </section>

        {related.length > 0 ? (
          <section className="mt-8 px-4 md:px-0">
            <h2 className="mb-4 text-lg font-bold md:text-xl">You may also like</h2>
            <ProductGrid products={related} />
          </section>
        ) : null}
      </div>

      <div className="fixed inset-x-0 z-40 border-t border-black/[0.08] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden bottom-[calc(4.8rem+env(safe-area-inset-bottom))]">
        <div className="flex items-stretch gap-2 px-3 py-2.5">
          <button
            type="button"
            disabled={!inStock}
            onClick={addToCart}
            className="flex h-12 flex-1 items-center justify-center border border-[#141414] px-1 text-[11px] font-semibold tracking-[0.06em] uppercase disabled:opacity-40"
          >
            {addedFlash ? "Added" : "Add to cart"}
          </button>
          <button
            type="button"
            disabled={!inStock}
            onClick={buyNow}
            className="flex h-12 flex-1 flex-col items-center justify-center bg-[#141414] px-1 text-white disabled:opacity-40"
          >
            <span className="text-[11px] font-semibold tracking-[0.06em] uppercase">Buy now</span>
            <span className="text-[10px] text-white/70 tabular-nums">{formatMoney(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Qty({
  value,
  set,
  rounded,
}: {
  value: number;
  set: (n: number | ((q: number) => number)) => void;
  rounded?: boolean;
}) {
  return (
    <div className={`inline-flex items-center border border-black/[0.12] ${rounded ? "rounded-full bg-[#f4f1eb]" : ""}`}>
      <button type="button" className="grid h-11 w-11 place-items-center text-lg" onClick={() => set((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
        −
      </button>
      <span className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums">{value}</span>
      <button type="button" className="grid h-11 w-11 place-items-center text-lg" onClick={() => set((q) => q + 1)} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}
