import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/SiteChrome";
import { ProductPageView } from "@/components/shop/ProductPageView";
import { getPublicProductBySlug, listRelated } from "@/lib/shop";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: product.description || `Buy ${product.name} on Connect Pro Shop.`,
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);
  if (!product) notFound();
  const related = await listRelated(product);
  return (
    <SiteChrome variant="wide">
      <ProductPageView product={product} related={related} />
    </SiteChrome>
  );
}
