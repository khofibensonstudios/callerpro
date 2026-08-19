"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Shop } from "@/lib/shop-shared";

export function ShopToggle() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/shop/mine", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setShop(d.shop ?? null))
      .catch(() => {});
  }, []);

  const on = shop && shop.status !== "off";

  async function toggle() {
    setBusy(true);
    const res = await fetch("/api/shop/mine", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !on }),
    });
    const d = await res.json();
    setBusy(false);
    if (res.ok) setShop(d.shop);
  }

  return (
    <div className="mt-4 rounded-xl bg-[#f4f1eb] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold">Seller shop</p>
          <p className="mt-0.5 text-[12px] text-[#6f6a64]">
            {!on
              ? "Turn this on if you want to sell. We’ll review your shop before you go live."
              : shop?.status === "pending"
                ? "Your shop is under review. You can set up products while you wait."
                : shop?.status === "rejected"
                  ? "Your shop wasn’t approved. You can apply again."
                  : "Your shop is verified. You’re live."}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggle()}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-[#141414]" : "bg-[#cfc8bf]"}`}
          aria-pressed={Boolean(on)}
          aria-label="Activate shop"
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition ${on ? "left-[1.4rem]" : "left-0.5"}`} />
        </button>
      </div>
      {on ? (
        <Link href="/shop/manage" className="mt-3 inline-block text-[13px] font-semibold text-[#141414] underline">
          Shop settings & products
        </Link>
      ) : null}
    </div>
  );
}
