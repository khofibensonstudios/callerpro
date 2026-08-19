"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { ProductGrid } from "./ProductGrid";
import { SHOP_CATEGORIES, type PublicProduct } from "@/lib/shop-shared";

type Sort = "default" | "price-asc" | "price-desc" | "name";

export function ShopView({ sellerId, sellerName }: { sellerId?: string; sellerName?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const categoryParam = (params.get("category") || "").trim();
  const sortParam = (params.get("sort") || "default") as Sort;
  const qParam = (params.get("q") || "").trim();

  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(qParam);

  const sort: Sort = ["default", "price-asc", "price-desc", "name"].includes(sortParam) ? sortParam : "default";

  useEffect(() => {
    setQ(qParam);
  }, [qParam]);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams();
    if (sellerId) qs.set("seller", sellerId);
    fetch(`/api/shop/catalog${qs.toString() ? `?${qs}` : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setProducts(Array.isArray(d.products) ? d.products : []);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  const filtered = useMemo(() => {
    let list = [...products];
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.description.toLowerCase().includes(needle) ||
          p.category.toLowerCase().includes(needle),
      );
    }
    if (categoryParam) list = list.filter((p) => p.category === categoryParam);
    if (sort === "price-asc") list.sort((a, b) => a.priceCents - b.priceCents);
    if (sort === "price-desc") list.sort((a, b) => b.priceCents - a.priceCents);
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, categoryParam, sort, q]);

  function setQuery(next: { category?: string; sort?: string; q?: string }) {
    const nextParams = new URLSearchParams(params.toString());
    if (next.category !== undefined) {
      if (next.category) nextParams.set("category", next.category);
      else nextParams.delete("category");
    }
    if (next.sort !== undefined) {
      if (!next.sort || next.sort === "default") nextParams.delete("sort");
      else nextParams.set("sort", next.sort);
    }
    if (next.q !== undefined) {
      if (next.q.trim()) nextParams.set("q", next.q.trim());
      else nextParams.delete("q");
    }
    nextParams.delete("brand");
    const qs = nextParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const heading = sellerName || "Shop";
  const hasFilters = Boolean(categoryParam) || Boolean(qParam) || sort !== "default";

  return (
    <div className="bg-[#f4f1eb]">
      <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-16 md:px-6 md:pt-8 md:pb-20">
        <h1 className="text-[1.65rem] font-semibold tracking-tight text-[#141414] md:text-[2rem]">{heading}</h1>

        <form
          className="relative mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery({ q });
          }}
        >
          <Search className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-[#6f6a64]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            className="h-12 w-full rounded-2xl bg-white pr-3 pl-10 text-sm outline-none ring-1 ring-black/[0.06]"
            autoComplete="off"
          />
        </form>

        <nav
          className="mt-6 flex gap-5 overflow-x-auto border-b border-black/[0.08] pb-3 [-ms-overflow-style:none] [scrollbar-width:none] md:gap-7 [&::-webkit-scrollbar]:hidden"
          aria-label="Categories"
        >
          <NavLink active={!categoryParam} onClick={() => setQuery({ category: "" })} label="All" />
          {SHOP_CATEGORIES.map((c) => (
            <NavLink key={c} active={categoryParam === c} onClick={() => setQuery({ category: c })} label={c} />
          ))}
        </nav>

        <div className="mt-3 flex items-center justify-between">
          <select
            value={sort}
            onChange={(e) => setQuery({ sort: e.target.value })}
            className="bg-transparent py-1 text-[12px] font-medium tracking-[0.12em] text-[#6f6a64] uppercase outline-none"
            aria-label="Sort products"
          >
            <option value="default">Featured</option>
            <option value="price-asc">Price · Low</option>
            <option value="price-desc">Price · High</option>
            <option value="name">A–Z</option>
          </select>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                router.replace(pathname, { scroll: false });
              }}
              className="text-[11px] font-semibold tracking-[0.14em] text-[#6f6a64] uppercase"
            >
              Reset
            </button>
          ) : null}
        </div>

        <div className="mt-8 md:mt-10">
          {loading ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 lg:grid-cols-4 lg:gap-x-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse bg-[#ebe6de]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-2xl font-semibold tracking-tight">Nothing here yet</p>
              <p className="mt-2 text-sm text-[#6f6a64]">Try another search, or check back soon.</p>
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  router.replace(pathname, { scroll: false });
                }}
                className="mt-8 inline-flex border border-[#141414] px-5 py-2.5 text-[12px] font-semibold tracking-[0.12em] uppercase"
              >
                View all
              </button>
            </div>
          ) : (
            <ProductGrid products={filtered} />
          )}
        </div>
      </div>
    </div>
  );
}

function NavLink({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 pb-3 text-[12px] font-semibold tracking-[0.14em] uppercase transition ${
        active ? "border-b-2 border-[#141414] text-[#141414]" : "border-b-2 border-transparent text-[#6f6a64] hover:text-[#141414]"
      }`}
    >
      {label}
    </button>
  );
}
