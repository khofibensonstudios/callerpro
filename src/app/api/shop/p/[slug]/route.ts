import { json, options } from "@/lib/http";
import { getPublicProductBySlug, listRelated } from "@/lib/shop";

export function OPTIONS() {
  return options();
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);
  if (!product) return json({ error: "Product not found." }, 404);
  const related = await listRelated(product);
  return json({ product, related });
}
