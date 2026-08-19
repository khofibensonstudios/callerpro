import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { publicUser, withDb } from "@/lib/store";
import { isGroupThread, threadMemberIds } from "@/lib/threads";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const groups = await withDb((db) =>
    db.threads
      .filter((t) => isGroupThread(t) && threadMemberIds(t).includes(me))
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
      .map((t) => {
        const members = threadMemberIds(t)
          .map((id) => db.users.find((u) => u.id === id))
          .filter(Boolean)
          .map((u) => publicUser(u!));
        const last = db.messages.filter((m) => m.threadId === t.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
        return {
          id: t.id,
          title: t.title || members.filter((m) => m.id !== me).map((m) => m.name).slice(0, 3).join(", ") || "Group",
          members,
          updatedAt: t.updatedAt,
          preview: last?.body || "No messages yet",
        };
      }),
  );
  return json({ groups });
}

export async function POST(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const body = (await req.json().catch(() => null)) as { title?: string; userIds?: string[] } | null;
  const picked = [...new Set((body?.userIds ?? []).filter((id) => id && id !== me))];
  if (picked.length < 1) return json({ error: "Add at least one person." }, 400);
  const title = String(body?.title || "").trim().slice(0, 40);
  const memberIds = [me, ...picked];
  const thread = await withDb((db) => {
    const created = {
      id: `t_${crypto.randomUUID()}`,
      userA: me,
      userB: picked[0],
      title: title || undefined,
      memberIds,
      updatedAt: new Date().toISOString(),
    };
    db.threads.push(created);
    return created;
  }, true);
  return json({ thread });
}
