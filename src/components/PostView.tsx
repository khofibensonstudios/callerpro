import Link from "next/link";
import { Avatar } from "./Avatar";
import { PersonLink } from "./PersonLink";
import { MediaThumb } from "./MediaThumb";
import { PostActions } from "./PostActions";
import { ViewBeacon } from "./ViewBeacon";
import { postPath } from "@/lib/seed-content";
import { timeAgo } from "@/lib/time";
import type { Post, PublicUser } from "@/lib/types";

export function PostView({
  post,
  author,
  related = [],
}: {
  post: Post;
  author: PublicUser;
  related?: { post: Post; author: PublicUser }[];
}) {
  if (post.kind === "blog") return null;
  if (post.kind === "video" || post.kind === "clip") {
    return <WatchPost post={post} author={author} related={related} />;
  }
  return <SocialPost post={post} author={author} />;
}

function jsonLd(post: Post, author: PublicUser) {
  if (post.videoUrl) {
    return {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: post.title,
      description: post.body,
      uploadDate: post.createdAt,
      contentUrl: post.videoUrl,
      thumbnailUrl: post.coverImage,
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    headline: post.title,
    datePublished: post.createdAt,
    author: { "@type": "Person", name: author.name },
  };
}

function WatchPost({
  post,
  author,
  related,
}: {
  post: Post;
  author: PublicUser;
  related: { post: Post; author: PublicUser }[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(post, author)) }} />
      <ViewBeacon postId={post.id} />
      <div>
        <div className="overflow-hidden rounded-xl bg-neutral-900">
          <video
            className="aspect-video w-full"
            controls
            playsInline
            poster={post.coverImage}
            preload="metadata"
            src={post.videoUrl}
          />
        </div>
        <h1 className="mt-3 text-xl font-bold leading-snug">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <PersonLink userId={author.id} className="flex items-center gap-3">
            <Avatar name={author.name} hue={author.avatarHue} src={author.avatarUrl} size={40} userId={author.id} />
            <div>
              <p className="font-semibold">{author.name}</p>
              <p className="text-xs text-fb-muted">{post.viewCount.toLocaleString()} views</p>
            </div>
          </PersonLink>
          <Link href={`/u/${author.id}`} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">
            Subscribe
          </Link>
        </div>
        <div className="mt-3 rounded-xl bg-white p-3 text-sm shadow-sm">
          <p className="font-semibold">{timeAgo(post.createdAt)}</p>
          <p className="mt-2 whitespace-pre-wrap">{post.body}</p>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
          <PostActions
            postId={post.id}
            likedBy={post.likedBy ?? []}
            commentCount={post.commentCount ?? 0}
            shareHref={`/p/${post.id}`}
            shareTitle={post.title}
          />
        </div>
      </div>
      <aside>
        <p className="mb-3 text-sm font-semibold">Up next</p>
        <ul className="space-y-3">
          {related
            .filter((r) => r.post.kind === "video" || r.post.kind === "clip")
            .map(({ post: r, author: a }) => (
            <li key={r.id}>
              <Link href={postPath(r.id, r.kind)} className="flex gap-2">
                <div className="w-[168px] shrink-0 overflow-hidden rounded-lg">
                  <MediaThumb post={r} className="h-[94px]" />
                </div>
                <div>
                  <p className="line-clamp-2 text-sm font-semibold leading-5">{r.title}</p>
                  <p className="mt-1 text-xs text-fb-muted">{a.name}</p>
                  <p className="text-xs text-fb-muted">{r.viewCount.toLocaleString()} views</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function SocialPost({ post, author }: { post: Post; author: PublicUser }) {
  return (
    <article className="rounded-lg bg-white p-4 shadow-sm">
      <ViewBeacon postId={post.id} />
      <div className="flex gap-2">
        <Avatar name={author.name} hue={author.avatarHue} src={author.avatarUrl} userId={author.id} />
        <div>
          <Link href={`/u/${author.id}`} className="font-semibold">
            {author.name}
          </Link>
          <p className="text-xs text-fb-muted">{timeAgo(post.createdAt)}</p>
        </div>
      </div>
      {post.title !== post.body ? <h1 className="mt-3 text-lg font-semibold">{post.title}</h1> : null}
      {post.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImage} alt="" className="mt-3 max-h-[520px] w-full rounded-lg object-contain" />
      ) : null}
      <p className="mt-2 whitespace-pre-wrap text-[15px] leading-6">{post.body}</p>
      <PostActions
        postId={post.id}
        likedBy={post.likedBy ?? []}
        commentCount={post.commentCount ?? 0}
        shareHref={`/p/${post.id}`}
        shareTitle={post.title}
      />
    </article>
  );
}
