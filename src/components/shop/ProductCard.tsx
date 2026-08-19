"use client";

import Link from "next/link";
import { formatMoney, type PublicProduct } from "@/lib/shop-shared";
import { useCart } from "./CartProvider";

export function ProductCard({ product }: { product: PublicProduct }) {
  const { addItem } = useCart();
  const image = product.images[0];

  return (
    <article className="group flex h-full flex-col bg-white">
      <div className="relative">
        <Link href={`/shop/p/${product.slug}`} className="block aspect-[3/4] overflow-hidden bg-[#ebe6de]">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
          ) : (
            <span className="grid h-full place-items-center text-xs text-[#6f6a64]">No photo</span>
          )}
        </Link>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] translate-y-2 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 max-md:translate-y-0 max-md:opacity-100">
          <button
            type="button"
            onClick={() =>
              addItem({
                productId: product.id,
                slug: product.slug,
                name: product.name,
                priceCents: product.priceCents,
                image,
              })
            }
            className="pointer-events-auto w-full bg-[#141414] py-3 text-[11px] uppercase tracking-[0.16em] text-white"
          >
            Add to cart
          </button>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-1 pt-3 pb-4">
        <p className="text-[11px] tracking-[0.16em] text-[#6f6a64] uppercase">{product.shopName}</p>
        <Link
          href={`/shop/p/${product.slug}`}
          className="line-clamp-2 text-sm leading-snug font-medium text-[#141414] sm:text-[15px]"
        >
          {product.name}
        </Link>
        <p className="mt-auto pt-1 text-sm font-semibold tabular-nums">{formatMoney(product.priceCents)}</p>
      </div>
    </article>
  );
}
