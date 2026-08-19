import { SiteChrome } from "@/components/SiteChrome";
import { SellerNav } from "@/components/shop/SellerNav";
import { ProductForm } from "@/components/shop/ProductForm";

export default function NewProductPage() {
  return (
    <SiteChrome variant="wide">
      <div className="bg-white px-4 py-8 md:px-10 md:py-10">
        <p className="text-[10px] font-semibold tracking-[0.22em] text-[#e85d04] uppercase">Seller</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Upload product</h1>
        <div className="mt-6">
          <SellerNav />
        </div>
        <div className="mt-10">
          <ProductForm />
        </div>
      </div>
    </SiteChrome>
  );
}
