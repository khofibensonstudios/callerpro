import { json, options } from "@/lib/http";
import { listPublicProducts } from "@/lib/shop";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") || undefined;
  const sellerId = url.searchParams.get("seller") || undefined;
  const products = await listPublicProducts({ category, sellerId });
  return json({ products });
}
