import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { publicUser, withDb } from "@/lib/store";
import { readPresence, touchPresence } from "@/lib/chat-presence";
import { markThreadRead } from "@/lib/inbox";
import { threadMemberIds } from "@/lib/threads";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  await touchPresence(me);
  const { id } = await params;

  const data = await withDb((db) => {
    const thread = db.threads.find((t) => t.id === id);
    if (!thread) return null;
    const members = threadMemberIds(thread);
    if (!members.includes(me)) return null;
    const otherId = members.find((uid) => uid !== me) || me;
    const other = db.users.find((u) => u.id === otherId);
    const people = members
      .map((uid) => db.users.find((u) => u.id === uid))
      .filter(Boolean)
      .map((u) => publicUser(u!));
    const messages = db.messages.filter((m) => m.threadId === id);
    markThreadRead(db, me, id);

    const lastFromOther = [...messages].reverse().find((m) => m.fromId !== me);
    const recentChat =
      lastFromOther && Date.now() - +new Date(lastFromOther.createdAt) < 3 * 60_000;

    return {
      thread,
      other: other ? publicUser(other) : null,
      people,
      messages,
      recentChat: Boolean(recentChat),
      otherId,
      isGroup: Boolean(thread.title) || members.length > 2,
      title: thread.title || "",
    };
  }, true);

  if (!data) return json({ error: "Thread not found." }, 404);

  const presence = await readPresence(data.otherId, id);
  const displayName = data.isGroup
    ? data.title || data.people.filter((p) => p.id !== me).map((p) => p.name).slice(0, 3).join(", ") || "Group"
    : data.other?.name;
  return json({
    thread: data.thread,
    other: data.other ? { ...data.other, name: displayName || data.other.name } : null,
    people: data.people,
    isGroup: data.isGroup,
    title: data.title,
    messages: data.messages,
    otherOnline: presence.online || data.recentChat,
    otherTyping: presence.typing,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  await touchPresence(me, null);
  const { id } = await params;
  const payload = (await req.json().catch(() => null)) as { body?: string } | null;
  const text = payload?.body?.trim() ?? "";
  if (text.length < 1) return json({ error: "Write a message." }, 400);

  const saved = await withDb((db) => {
    const thread = db.threads.find((t) => t.id === id);
    if (!thread || !threadMemberIds(thread).includes(me)) return null;
    const message = {
      id: `m_${crypto.randomUUID()}`,
      threadId: id,
      fromId: me,
      body: text.slice(0, 8000),
      createdAt: new Date().toISOString(),
    };
    db.messages.push(message);
    thread.updatedAt = message.createdAt;
    return message;
  }, true);
  if (!saved) return json({ error: "Thread not found." }, 404);
  return json({ message: saved });
}
