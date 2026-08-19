import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { publicUser, withDb } from "@/lib/store";
import { findCallForUser, listRecentCalls } from "@/lib/chat-call";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);

  const history = new URL(req.url).searchParams.get("history") === "1";
  if (history) {
    const rows = await listRecentCalls(me);
    const people = await withDb((db) => {
      const ids = new Set(rows.flatMap((c) => c.participantIds));
      return [...ids]
        .map((id) => db.users.find((u) => u.id === id))
        .filter(Boolean)
        .map((u) => publicUser(u!));
    });
    const byId = new Map(people.map((p) => [p.id, p]));
    return json({
      calls: rows.map((c) => ({
        threadId: c.threadId,
        callerId: c.callerId,
        status: c.status,
        mode: c.mode,
        updatedAt: c.updatedAt,
        outgoing: c.callerId === me,
        missed: c.status === "ended" && c.joinedIds.length < 2 && c.callerId !== me,
        people: c.participantIds.filter((id) => id !== me).map((id) => byId.get(id)).filter(Boolean),
      })),
    });
  }

  const call = await findCallForUser(me);
  if (!call) return json({ call: null });

  const people = await withDb((db) =>
    call.participantIds
      .map((id) => db.users.find((u) => u.id === id))
      .filter(Boolean)
      .map((u) => publicUser(u!)),
  );
  const other = people.find((p) => p.id !== me) || null;
  const pending = !call.joinedIds.includes(me);

  return json({
    call: {
      threadId: call.threadId,
      callerId: call.callerId,
      calleeId: call.calleeId,
      status: call.status,
      mode: call.mode,
      participantIds: call.participantIds,
      joinedIds: call.joinedIds,
      pending,
      role: call.callerId === me ? "caller" : "callee",
      other,
      people,
    },
  });
}
