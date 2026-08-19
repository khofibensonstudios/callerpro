import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { pushActivity } from "@/lib/inbox";
import { recordLiveFollow } from "@/lib/live";
import { withDb } from "@/lib/store";

export function OPTIONS() {
  return options();
}

export async function GET(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const graph = await withDb((db) => {
    const following = db.follows.filter((f) => f.followerId === me).map((f) => f.followingId);
    const followers = db.follows.filter((f) => f.followingId === me).map((f) => f.followerId);
    return { following, followers };
  });
  return json(graph);
}

export async function POST(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in to follow." }, 401);
  const body = (await req.json().catch(() => null)) as { userId?: string } | null;
  const other = body?.userId;
  if (!other || other === me) return json({ error: "Pick a person." }, 400);

  const result = await withDb((db) => {
    const exists = db.follows.find((f) => f.followerId === me && f.followingId === other);
    if (exists) {
      db.follows = db.follows.filter((f) => !(f.followerId === me && f.followingId === other));
      return { following: false };
    }
    db.follows.push({ followerId: me, followingId: other, createdAt: new Date().toISOString() });
    pushActivity(db, { userId: other, actorId: me, kind: "follow" });
    const hasThread = db.threads.some(
      (t) => (t.userA === me && t.userB === other) || (t.userA === other && t.userB === me),
    );
    if (!hasThread) {
      db.threads.push({
        id: `t_${crypto.randomUUID()}`,
        userA: me,
        userB: other,
        updatedAt: new Date().toISOString(),
      });
    }
    return { following: true };
  }, true);

  if (result.following) {
    await recordLiveFollow(other, me);
  }
  return json(result);
}
