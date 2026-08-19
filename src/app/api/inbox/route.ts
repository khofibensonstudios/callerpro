import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { buildInbox, markActivityRead } from "@/lib/inbox";
import { publicUser, withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const id = await userIdFromRequest(req);
  if (!id) return json({ error: "Sign in required." }, 401);
  const items = await withDb((db) => buildInbox(db, id));
  return json({ items });
}

export async function POST(req: Request) {
  const id = await userIdFromRequest(req);
  if (!id) return json({ error: "Sign in required." }, 401);
  const body = (await req.json().catch(() => null)) as {
    userId?: string;
    callerId?: string;
    body?: string;
    activityId?: string;
    markRead?: boolean;
  } | null;

  if (body?.activityId) {
    await withDb((db) => {
      markActivityRead(db, id, body.activityId!);
    }, true);
    const items = await withDb((db) => buildInbox(db, id));
    return json({ ok: true, items });
  }

  let otherId = body?.userId;
  if (!otherId && body?.callerId) {
    const digits = String(body.callerId).replace(/\D/g, "");
    otherId = await withDb((db) => db.users.find((u) => u.callerId === digits)?.id);
  }
  if (!otherId || otherId === id) return json({ error: "Enter a caller ID." }, 400);
  const text = body?.body?.trim() ?? "";

  const thread = await withDb((db) => {
    let existing = db.threads.find(
      (t) =>
        !(t.memberIds && t.memberIds.length > 2) &&
        !t.title &&
        ((t.userA === id && t.userB === otherId) || (t.userA === otherId && t.userB === id)),
    );
    if (!existing) {
      existing = {
        id: `t_${crypto.randomUUID()}`,
        userA: id,
        userB: otherId,
        updatedAt: new Date().toISOString(),
      };
      db.threads.push(existing);
    }
    if (text) {
      const message = {
        id: `m_${crypto.randomUUID()}`,
        threadId: existing.id,
        fromId: id,
        body: text.slice(0, 8000),
        createdAt: new Date().toISOString(),
      };
      db.messages.push(message);
      existing.updatedAt = message.createdAt;
    }
    return existing;
  }, true);
  const other = await withDb((db) => {
    const u = db.users.find((x) => x.id === otherId);
    return u ? publicUser(u) : null;
  });
  return json({ thread, other });
}
