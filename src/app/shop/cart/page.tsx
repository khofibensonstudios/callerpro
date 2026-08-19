"use client";

import Link from "next/link";
import { SiteChrome } from "@/components/SiteChrome";
import { useCart } from "@/components/shop/CartProvider";
import { formatMoney } from "@/lib/shop-shared";

export default function CartPage() {
  const { items, setQuantity, removeItem, subtotal, clear } = useCart();

  return (
    <SiteChrome variant="wide">
      <div className="bg-[#f4f1eb] px-4 py-10 md:px-8 md:py-12">
        <p className="text-[11px] font-bold tracking-[0.22em] text-[#e85d04] uppercase">Bag</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">Shopping cart</h1>

        {!items.length ? (
          <div className="mt-12 bg-white px-6 py-16 text-center shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.06]">
            <p className="text-2xl font-bold">Your cart is empty</p>
            <p className="mt-2 text-sm text-[#6f6a64]">Browse the shop and add something you like.</p>
            <Link href="/shop" className="mt-8 inline-flex bg-[#141414] px-5 py-3 text-[12px] font-semibold tracking-[0.12em] text-white uppercase">
              Continue shopping
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.45fr_0.75fr]">
            <ul className="divide-y divide-black/[0.06] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.06]">
              {items.map((item) => (
                <li key={item.productId} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="h-28 w-24 shrink-0 overflow-hidden bg-[#f4f2ee]">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1">
                    <Link href={`/shop/p/${item.slug}`} className="font-semibold hover:text-[#e85d04]">
                      {item.name}
                    </Link>
                    <p className="mt-1 text-sm text-[#6f6a64]">{formatMoney(item.priceCents)}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => setQuantity(item.productId, Number(e.target.value) || 1)}
                        className="w-16 border border-black/[0.12] px-2 py-1.5 text-sm"
                      />
                      <button type="button" onClick={() => removeItem(item.productId)} className="text-sm text-[#6f6a64] hover:text-[#141414]">
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="font-semibold tabular-nums sm:w-28 sm:text-right">{formatMoney(item.priceCents * item.quantity)}</p>
                </li>
              ))}
            </ul>

            <aside className="h-fit bg-[#141414] p-6 text-white shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
              <h2 className="text-2xl font-bold">Order summary</h2>
              <div className="mt-5 flex justify-between text-sm">
                <span className="text-white/55">Subtotal</span>
                <span className="font-semibold tabular-nums">{formatMoney(subtotal)}</span>
              </div>
              <p className="mt-3 text-xs text-white/45">Delivery is confirmed at checkout.</p>
              <Link
                href="/shop/checkout"
                className="mt-6 flex w-full items-center justify-center bg-white py-3 text-[11px] font-bold tracking-[0.14em] text-[#141414] uppercase"
              >
                Proceed to checkout
              </Link>
              <button type="button" onClick={clear} className="mt-4 w-full text-center text-sm text-white/45 hover:text-white">
                Clear cart
              </button>
            </aside>
          </div>
        )}
      </div>
    </SiteChrome>
  );
}
