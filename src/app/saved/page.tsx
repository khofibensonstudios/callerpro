import type { Metadata } from "next";
import Link from "next/link";
import { SiteChrome } from "@/components/SiteChrome";
import { FeedCard } from "@/components/FeedCard";
import { publicUser, toClientPost, withDb } from "@/lib/store";
import { sessionUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved",
  description: "Posts you saved to watch later.",
};

export default async function SavedPage() {
  const me = await sessionUserId();
  if (!me) {
    return (
      <SiteChrome variant="wide">
        <h1 className="text-xl font-bold tracking-tight">Saved</h1>
        <p className="mt-4 text-sm">
          <Link href="/login" className="font-semibold">
            Log in
          </Link>{" "}
          to see posts you saved for later.
        </p>
      </SiteChrome>
    );
  }

  const items = await withDb((db) => {
    const ids = (db.saves ?? [])
      .filter((s) => s.userId === me)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((s) => s.postId);
    return ids
      .map((id) => {
        const post = db.posts.find((p) => p.id === id);
        const author = db.users.find((u) => u.id === post?.authorId);
        if (!post || !author || post.published === false) return null;
        return { post: toClientPost(post), author: publicUser(author) };
      })
      .filter((row): row is NonNullable<typeof row> => !!row);
  });

  return (
    <SiteChrome>
      <h1 className="mb-4 text-xl font-bold tracking-tight">Saved</h1>
      <p className="mb-4 text-sm text-fb-muted">Watch later in the app. Nothing is downloaded to your phone.</p>
      {!items.length ? (
        <p className="text-sm text-fb-muted">Nothing saved yet. Bookmark a video while watching.</p>
      ) : (
        items.map(({ post, author }) => <FeedCard key={post.id} post={post} author={author} from="watch" />)
      )}
    </SiteChrome>
  );
}
