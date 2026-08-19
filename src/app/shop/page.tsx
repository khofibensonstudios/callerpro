import type { Metadata } from "next";
import { SiteChrome } from "@/components/SiteChrome";
import { ShopView } from "@/components/shop/ShopView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse and buy products on Connect Pro.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  return (
    <SiteChrome variant="wide">
      <ShopView />
    </SiteChrome>
  );
}
