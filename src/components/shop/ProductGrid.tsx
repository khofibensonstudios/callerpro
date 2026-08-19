import { ProductCard } from "./ProductCard";
import type { PublicProduct } from "@/lib/shop-shared";

export function ProductGrid({ products }: { products: PublicProduct[] }) {
  if (!products.length) {
    return (
      <div className="bg-white px-6 py-16 text-center ring-1 ring-black/[0.06]">
        <p className="text-[#6f6a64]">No products found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
