import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { listBuyerOrders, listSellerOrders } from "@/lib/shop";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const kind = new URL(req.url).searchParams.get("as");
  const orders = kind === "seller" ? await listSellerOrders(me) : await listBuyerOrders(me);
  return json({ orders });
}
