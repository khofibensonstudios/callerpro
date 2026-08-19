import { z } from "zod";
import { json, options } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { publicUser, withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const me = await requireUser(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const people = await withDb((db) => {
    const ids = (db.blocks ?? []).filter((b) => b.blockerId === me.id).map((b) => b.blockedId);
    return ids
      .map((id) => db.users.find((u) => u.id === id))
      .filter(Boolean)
      .map((u) => publicUser(u!));
  });
  return json({ people });
}

const body = z.object({ userId: z.string().min(1) });

export async function POST(req: Request) {
  const me = await requireUser(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.userId === me.id) return json({ error: "Pick someone to block." }, 400);
  const people = await withDb((db) => {
    db.blocks ??= [];
    const exists = db.blocks.some((b) => b.blockerId === me.id && b.blockedId === parsed.data.userId);
    if (!exists) {
      db.blocks.push({ blockerId: me.id, blockedId: parsed.data.userId, createdAt: new Date().toISOString() });
    }
    const ids = db.blocks.filter((b) => b.blockerId === me.id).map((b) => b.blockedId);
    return ids
      .map((id) => db.users.find((u) => u.id === id))
      .filter(Boolean)
      .map((u) => publicUser(u!));
  }, true);
  return json({ people });
}

export async function DELETE(req: Request) {
  const me = await requireUser(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Pick someone to unblock." }, 400);
  const people = await withDb((db) => {
    db.blocks = (db.blocks ?? []).filter((b) => !(b.blockerId === me.id && b.blockedId === parsed.data.userId));
    const ids = db.blocks.filter((b) => b.blockerId === me.id).map((b) => b.blockedId);
    return ids
      .map((id) => db.users.find((u) => u.id === id))
      .filter(Boolean)
      .map((u) => publicUser(u!));
  }, true);
  return json({ people });
}
