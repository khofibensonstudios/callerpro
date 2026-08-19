import { z } from "zod";
import { json, options } from "@/lib/http";
import { withDb, publicUser } from "@/lib/store";
import { attachAuthCookie, signToken } from "@/lib/auth";
import { defaultPortrait } from "@/lib/constants";
import { allocCallerId, hashPin, isPin, pinDigest } from "@/lib/pin";

export function OPTIONS() {
  return options();
}

const schema = z.object({
  pin: z.string(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  const pin = parsed.success ? parsed.data.pin : "";
  if (!isPin(pin)) return json({ error: "Set a 4-digit PIN." }, 400);

  const digest = pinDigest(pin);
  const created = await withDb((db) => {
    if (db.users.some((u) => u.pinDigest === digest)) {
      return { error: "That PIN is already in use. Pick another." as const };
    }
    const callerId = allocCallerId(new Set(db.users.map((u) => u.callerId).filter(Boolean) as string[]));
    const user = {
      id: `u_${crypto.randomUUID()}`,
      email: `${callerId}@pin.connect.pro`,
      passwordHash: hashPin(pin),
      pinDigest: digest,
      callerId,
      name: callerId,
      headline: "",
      bio: "",
      skills: [] as string[],
      formats: [] as import("@/lib/types").PostKind[],
      avatarHue: Math.floor(Math.random() * 360),
      avatarUrl: defaultPortrait(callerId),
      balanceMicros: 0,
      lifetimeMicros: 0,
      onboarded: true,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    return { user };
  }, true);

  if ("error" in created) return json({ error: created.error }, 409);
  const token = signToken(created.user.id, { name: created.user.name, callerId: created.user.callerId });
  return attachAuthCookie(json({ token, user: publicUser(created.user, true) }), token);
}
