"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SHOP_CATEGORIES, type ShopProduct } from "@/lib/shop-shared";

export function ProductForm({ product }: { product?: ShopProduct }) {
  const router = useRouter();
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [price, setPrice] = useState(product ? (product.priceCents / 100).toFixed(2) : "");
  const [category, setCategory] = useState(product?.category || "Other");
  const [stock, setStock] = useState(String(product?.stock ?? 1));
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [published, setPublished] = useState(Boolean(product?.published));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files).slice(0, 8 - images.length)) {
        const form = new FormData();
        form.set("file", file);
        const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: form });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Upload failed");
        if (d.url) setImages((prev) => [...prev, d.url].slice(0, 8));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    setBusy(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setWarning(null);
    const priceCents = Math.round(Number(price) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError("Enter a valid price.");
      setBusy(false);
      return;
    }
    const payload = {
      name,
      description,
      priceCents,
      images,
      category,
      stock: Number(stock) || 0,
      published,
    };
    const res = await fetch(product ? `/api/shop/mine/products/${product.id}` : "/api/shop/mine/products", {
      method: product ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not save.");
      return;
    }
    if (d.warning) setWarning(d.warning);
    router.push("/shop/manage/products");
    router.refresh();
  }

  const field = "mt-2 h-12 w-full border-0 border-b border-[#141414]/20 bg-transparent text-lg outline-none focus:border-[#e85d04]";

  return (
    <form onSubmit={submit} className="max-w-lg space-y-7">
      <label className="block">
        <span className="text-xs tracking-wide text-[#6f6a64] uppercase">Name</span>
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
      </label>
      <label className="block">
        <span className="text-xs tracking-wide text-[#6f6a64] uppercase">Price (USD)</span>
        <input className={field} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" required placeholder="24.00" />
      </label>
      <label className="block">
        <span className="text-xs tracking-wide text-[#6f6a64] uppercase">Category</span>
        <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
          {SHOP_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs tracking-wide text-[#6f6a64] uppercase">Stock</span>
        <input className={field} value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" />
      </label>
      <label className="block">
        <span className="text-xs tracking-wide text-[#6f6a64] uppercase">Description</span>
        <textarea
          className="mt-2 min-h-28 w-full border-0 border-b border-[#141414]/20 bg-transparent py-2 text-base outline-none focus:border-[#e85d04]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
        />
      </label>
      <div>
        <p className="text-xs tracking-wide text-[#6f6a64] uppercase">Photos</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((src) => (
            <div key={src} className="relative h-20 w-20 overflow-hidden bg-[#ebe6de]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute top-0 right-0 bg-black/70 px-1.5 text-[10px] text-white"
                onClick={() => setImages((prev) => prev.filter((x) => x !== src))}
              >
                ×
              </button>
            </div>
          ))}
          {images.length < 8 ? (
            <label className="grid h-20 w-20 cursor-pointer place-items-center bg-[#f4f1eb] text-2xl text-[#6f6a64]">
              +
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
            </label>
          ) : null}
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        List this product (goes live after your shop is verified)
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {warning ? <p className="text-sm text-[#6f6a64]">{warning}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="bg-[#141414] px-6 py-3 text-[12px] font-semibold tracking-[0.14em] text-white uppercase disabled:opacity-50"
      >
        {busy ? "Saving…" : product ? "Save product" : "Upload product"}
      </button>
    </form>
  );
}
