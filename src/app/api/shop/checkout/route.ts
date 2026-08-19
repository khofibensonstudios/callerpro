import { z } from "zod";
import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { createOrder } from "@/lib/shop";

export function OPTIONS() {
  return options();
}

const body = z.object({
  fullName: z.string().min(2).max(80),
  phone: z.string().min(6).max(40),
  address: z.string().min(4).max(240),
  notes: z.string().max(400).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(40),
});

export async function POST(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Fill in your delivery details." }, 400);
  try {
    const order = await createOrder({
      buyerId: me,
      name: parsed.data.fullName,
      phone: parsed.data.phone,
      address: parsed.data.address,
      notes: parsed.data.notes,
      items: parsed.data.items,
    });
    return json({ order });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Checkout failed." }, 400);
  }
}
