import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { withDb } from "@/lib/store";
import { adPayoutMicros, viewPayoutMicros } from "@/lib/earnings";

export function OPTIONS() {
  return options();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: postId } = await params;
  const viewerId = (await userIdFromRequest(req)) || `anon_${req.headers.get("x-forwarded-for") || "local"}`;

  const result = await withDb((db) => {
    const post = db.posts.find((p) => p.id === postId);
    if (!post) return { error: "Post not found." as const };

    const recent = db.views.find(
      (v) =>
        v.postId === postId &&
        v.viewerId === viewerId &&
        Date.now() - +new Date(v.createdAt) < 1000 * 60 * 30,
    );
    if (recent) {
      return { post, credited: false as const };
    }

    db.views.push({
      id: `v_${crypto.randomUUID()}`,
      postId,
      viewerId,
      createdAt: new Date().toISOString(),
    });
    post.viewCount += 1;

    if (post.authorId !== viewerId) {
      const viewPay = viewPayoutMicros();
      const adPay = adPayoutMicros();
      const total = viewPay + adPay;
      post.earnMicros += total;
      const author = db.users.find((u) => u.id === post.authorId);
      if (author) {
        author.balanceMicros += total;
        author.lifetimeMicros += total;
      }
      db.ledger.push(
        {
          id: `l_${crypto.randomUUID()}`,
          userId: post.authorId,
          postId,
          source: "view",
          micros: viewPay,
          createdAt: new Date().toISOString(),
        },
        {
          id: `l_${crypto.randomUUID()}`,
          userId: post.authorId,
          postId,
          source: "ad",
          micros: adPay,
          createdAt: new Date().toISOString(),
        },
      );
    }

    return { post, credited: true as const };
  }, true);

  if ("error" in result) return json({ error: result.error }, 404);
  return json(result);
}
