"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteChrome } from "@/components/SiteChrome";
import { useCart } from "@/components/shop/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { formatMoney } from "@/lib/shop-shared";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!items.length) {
    return (
      <SiteChrome variant="wide">
        <div className="px-4 py-20 text-center">
          <h1 className="text-3xl font-bold">Nothing to checkout</h1>
          <Link href="/shop" className="mt-8 inline-flex bg-[#141414] px-5 py-3 text-[12px] font-semibold tracking-[0.12em] text-white uppercase">
            Back to shop
          </Link>
        </div>
      </SiteChrome>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      router.push("/login?next=/shop/checkout");
      return;
    }
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.get("fullName"),
          phone: form.get("phone"),
          address: form.get("address"),
          notes: form.get("notes"),
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      clear();
      router.push(`/shop/orders?placed=${data.order?.id || "1"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <SiteChrome variant="wide">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-8 md:py-12 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {(
              [
                ["fullName", "Full name", "text", user?.name || ""],
                ["phone", "Phone", "tel", ""],
                ["address", "Delivery address", "text", ""],
              ] as const
            ).map(([name, label, type, value]) => (
              <label key={name} className="block text-sm">
                <span className="mb-1.5 block text-[#6f6a64]">{label}</span>
                <input
                  name={name}
                  type={type}
                  required
                  defaultValue={value}
                  className="w-full border border-black/[0.12] bg-white px-3 py-3 outline-none focus:border-[#141414]"
                />
              </label>
            ))}
            <label className="block text-sm">
              <span className="mb-1.5 block text-[#6f6a64]">Order notes</span>
              <textarea name="notes" rows={3} className="w-full border border-black/[0.12] bg-white px-3 py-3 outline-none focus:border-[#141414]" />
            </label>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button type="submit" disabled={loading} className="bg-[#141414] px-6 py-3 text-[12px] font-semibold tracking-[0.12em] text-white uppercase disabled:opacity-50">
              {loading ? "Placing order…" : `Place order · ${formatMoney(subtotal)}`}
            </button>
          </form>
        </div>
        <aside className="h-fit border border-black/[0.08] bg-white p-6">
          <h2 className="text-2xl font-semibold">Your order</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3">
                <span className="text-[#6f6a64]">
                  {i.name} × {i.quantity}
                </span>
                <span className="tabular-nums">{formatMoney(i.priceCents * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex justify-between border-t border-black/[0.08] pt-4 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(subtotal)}</span>
          </p>
        </aside>
      </div>
    </SiteChrome>
  );
}
