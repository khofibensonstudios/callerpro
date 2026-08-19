import { z } from "zod";
import { json, options } from "@/lib/http";
import { withDb, publicUser } from "@/lib/store";
import { attachAuthCookie, signToken } from "@/lib/auth";
import { isPin, pinDigest } from "@/lib/pin";

export function OPTIONS() {
  return options();
}

const schema = z.object({
  pin: z.string(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  const pin = parsed.success ? parsed.data.pin : "";
  if (!isPin(pin)) return json({ error: "Enter your 4-digit PIN." }, 400);

  const digest = pinDigest(pin);
  const user = await withDb((db) => db.users.find((u) => u.pinDigest === digest));
  if (!user) return json({ error: "That PIN does not match an account." }, 401);
  if (user.accountStatus && user.accountStatus !== "active") {
    return json({ error: "This account is not available." }, 403);
  }

  const token = signToken(user.id, { name: user.name, callerId: user.callerId });
  return attachAuthCookie(json({ token, user: publicUser(user, true) }), token);
}
