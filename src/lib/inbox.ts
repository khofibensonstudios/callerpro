import type { Activity, DB } from "@/lib/types";
import { publicUser } from "@/lib/store";
import type { InboxItem } from "./inbox-shared";
import { isGroupThread, threadMemberIds } from "./threads";
import { contactName } from "./contacts";

export type { InboxItem } from "./inbox-shared";
export { inboxHref } from "./inbox-shared";

function previewMessage(body: string) {
  if (body.startsWith("<<img>>")) return "Sent a photo";
  if (body.startsWith("<<audio>>")) return "Sent a voice message";
  return body;
}

export function buildInbox(db: DB, me: string): InboxItem[] {
  const items: InboxItem[] = [];
  const reads = new Map(
    (db.threadReads ?? [])
      .filter((r) => r.userId === me)
      .map((r) => [r.threadId, r.lastReadAt] as const),
  );

  for (const t of db.threads) {
    const members = threadMemberIds(t);
    if (!members.includes(me)) continue;
    const group = isGroupThread(t);
    const otherId = members.find((id) => id !== me) || me;
    const otherUser = db.users.find((u) => u.id === otherId);
    if (!otherUser) continue;
    const threadMsgs = db.messages.filter((m) => m.threadId === t.id);
    const last = threadMsgs.length ? threadMsgs.reduce((a, b) => (+new Date(a.createdAt) > +new Date(b.createdAt) ? a : b)) : null;
    if (!last && !group) continue;
    const lastRead = reads.get(t.id);
    const unread = threadMsgs.some(
      (m) => m.fromId !== me && (!lastRead || +new Date(m.createdAt) > +new Date(lastRead)),
    );
    const mine = last ? last.fromId === me : false;
    const names = members
      .filter((id) => id !== me)
      .map((id) => contactName(db, me, id) || db.users.find((u) => u.id === id)?.callerId || db.users.find((u) => u.id === id)?.name)
      .filter(Boolean) as string[];
    const label = group ? t.title || names.slice(0, 3).join(", ") || "Group" : contactName(db, me, otherId) || otherUser.callerId || otherUser.name;
    items.push({
      id: `chat_${t.id}`,
      kind: "chat",
      at: last?.createdAt || t.updatedAt,
      unread,
      preview: last ? (mine ? `You: ${previewMessage(last.body)}` : previewMessage(last.body)) : "No messages yet",
      other: { ...publicUser(otherUser), name: label },
      threadId: t.id,
      isGroup: group,
      title: label,
    });
  }

  for (const a of db.activities ?? []) {
    if (a.userId !== me) continue;
    const actor = db.users.find((u) => u.id === a.actorId);
    if (!actor) continue;
    if (a.kind === "follow") {
      items.push({
        id: `act_${a.id}`,
        kind: "follow",
        at: a.createdAt,
        unread: !a.readAt,
        preview: "started following you",
        other: publicUser(actor),
        activityId: a.id,
      });
      continue;
    }
    if (a.kind === "like") {
      const post = a.refId ? db.posts.find((p) => p.id === a.refId) : null;
      items.push({
        id: `act_${a.id}`,
        kind: "like",
        at: a.createdAt,
        unread: !a.readAt,
        preview: post?.title ? `liked your post “${post.title}”` : "liked your post",
        other: publicUser(actor),
        activityId: a.id,
        postId: a.refId,
      });
      continue;
    }
    if (a.kind === "comment") {
      items.push({
        id: `act_${a.id}`,
        kind: "comment",
        at: a.createdAt,
        unread: !a.readAt,
        preview: "commented on your post",
        other: publicUser(actor),
        activityId: a.id,
        postId: a.refId,
      });
      continue;
    }
    if (a.kind === "mention") {
      items.push({
        id: `act_${a.id}`,
        kind: "mention",
        at: a.createdAt,
        unread: !a.readAt,
        preview: "tagged you in a comment",
        other: publicUser(actor),
        activityId: a.id,
        postId: a.refId,
      });
      continue;
    }
    if (a.kind === "comment_like") {
      items.push({
        id: `act_${a.id}`,
        kind: "comment_like",
        at: a.createdAt,
        unread: !a.readAt,
        preview: "liked your comment",
        other: publicUser(actor),
        activityId: a.id,
        postId: a.refId,
      });
    }
  }

  // Backfill follow notices for follows that never wrote an activity row
  const activityFollowKeys = new Set(
    (db.activities ?? [])
      .filter((a) => a.userId === me && a.kind === "follow")
      .map((a) => a.actorId),
  );
  for (const f of db.follows) {
    if (f.followingId !== me) continue;
    if (activityFollowKeys.has(f.followerId)) continue;
    const actor = db.users.find((u) => u.id === f.followerId);
    if (!actor) continue;
    const at = f.createdAt || actor.createdAt;
    items.push({
      id: `follow_${f.followerId}`,
      kind: "follow",
      at,
      unread: false,
      preview: "started following you",
      other: publicUser(actor),
    });
  }

  return items.sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

export function pushActivity(
  db: DB,
  input: { userId: string; actorId: string; kind: Activity["kind"]; refId?: string },
) {
  if (input.userId === input.actorId) return;
  db.activities ??= [];
  if (input.kind === "follow") {
    const exists = db.activities.find(
      (a) => a.userId === input.userId && a.actorId === input.actorId && a.kind === "follow" && !a.readAt,
    );
    if (exists) {
      exists.createdAt = new Date().toISOString();
      return exists;
    }
  }
  const row = {
    id: `act_${crypto.randomUUID()}`,
    userId: input.userId,
    actorId: input.actorId,
    kind: input.kind,
    refId: input.refId,
    createdAt: new Date().toISOString(),
  };
  db.activities.push(row);
  return row;
}

export function markThreadRead(db: DB, userId: string, threadId: string) {
  db.threadReads ??= [];
  const now = new Date().toISOString();
  const existing = db.threadReads.find((r) => r.userId === userId && r.threadId === threadId);
  if (existing) existing.lastReadAt = now;
  else db.threadReads.push({ userId, threadId, lastReadAt: now });
}

export function markActivityRead(db: DB, userId: string, activityId: string) {
  db.activities ??= [];
  const a = db.activities.find((x) => x.id === activityId && x.userId === userId);
  if (a) a.readAt = new Date().toISOString();
}
