"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { SiteChrome } from "@/components/SiteChrome";
import { SellerNav } from "@/components/shop/SellerNav";
import type { Shop } from "@/lib/shop-shared";

export default function ShopManagePage() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/shop/mine", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const s = d.shop as Shop | null;
        setShop(s);
        setName(s?.name || "");
        setBio(s?.bio || "");
      });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/shop/mine", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, bio }),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMsg(d.error || "Could not save.");
      return;
    }
    setShop(d.shop);
    setMsg("Saved.");
  }

  const status = shop?.status || "off";

  return (
    <SiteChrome variant="wide">
      <div className="bg-white px-4 py-8 md:px-10 md:py-10">
        <p className="text-[10px] font-semibold tracking-[0.22em] text-[#e85d04] uppercase">Seller</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Shop settings</h1>
        <div className="mt-6">
          <SellerNav />
        </div>

        {status === "off" ? (
          <p className="mt-8 text-sm text-[#6f6a64]">
            Activate your shop from your <Link href="/profile" className="underline">profile</Link> first.
          </p>
        ) : (
          <>
            <div
              className={`mt-8 rounded-xl px-4 py-3 text-sm ${
                status === "verified"
                  ? "bg-emerald-50 text-emerald-800"
                  : status === "rejected"
                    ? "bg-red-50 text-red-800"
                    : "bg-[#f4f1eb] text-[#141414]"
              }`}
            >
              {status === "verified"
                ? "Verified. Your listed products are live in Shop."
                : status === "rejected"
                  ? "Not approved. Update your details and turn the shop back on from your profile to apply again."
                  : "Under review. You can upload products now — they stay in draft until we verify you."}
            </div>

            <form onSubmit={save} className="mt-10 max-w-lg space-y-8">
              <label className="block">
                <span className="text-xs tracking-wide text-[#6f6a64] uppercase">Shop name</span>
                <input
                  className="mt-2 h-12 w-full border-0 border-b border-[#141414]/20 bg-transparent text-lg outline-none focus:border-[#e85d04]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <label className="block">
                <span className="text-xs tracking-wide text-[#6f6a64] uppercase">About your shop</span>
                <textarea
                  className="mt-2 min-h-28 w-full border-0 border-b border-[#141414]/20 bg-transparent py-2 text-base outline-none focus:border-[#e85d04]"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={400}
                />
              </label>
              {msg ? <p className="text-sm text-[#6f6a64]">{msg}</p> : null}
              <button
                type="submit"
                disabled={saving}
                className="bg-[#141414] px-6 py-3 text-[12px] font-semibold tracking-[0.14em] text-white uppercase disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
            </form>
          </>
        )}
      </div>
    </SiteChrome>
  );
}
