import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { publicUser, withDb } from "@/lib/store";
import { contactName, listContacts, upsertContact } from "@/lib/contacts";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const callerId = url.searchParams.get("callerId")?.replace(/\D/g, "");
  const data = await withDb((db) => {
    if (userId || callerId) {
      const user = userId
        ? db.users.find((u) => u.id === userId)
        : db.users.find((u) => u.callerId === callerId);
      if (!user || user.id === me) return { contact: null };
      const name = contactName(db, me, user.id);
      return { contact: name ? { userId: user.id, name, user: publicUser(user) } : null };
    }
    return { contacts: listContacts(db, me) };
  });
  return json(data);
}

export async function POST(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const body = (await req.json().catch(() => null)) as { userId?: string; callerId?: string; name?: string } | null;
  const name = String(body?.name || "").trim().slice(0, 60);
  if (name.length < 1) return json({ error: "Enter a name." }, 400);
  const saved = await withDb((db) => {
    const user = body?.userId
      ? db.users.find((u) => u.id === body.userId)
      : db.users.find((u) => u.callerId === String(body?.callerId || "").replace(/\D/g, ""));
    if (!user || user.id === me) return null;
    upsertContact(db, me, user, name);
    return { userId: user.id, name, user: publicUser(user) };
  }, true);
  if (!saved) return json({ error: "No account with that caller ID." }, 404);
  return json({ contact: saved });
}
