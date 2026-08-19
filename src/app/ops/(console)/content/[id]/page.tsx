import { notFound } from "next/navigation";
import { CommentDeleteButton, FlagButton, PostModButtons } from "@/components/ops/OpsActions";
import { OpsTitle } from "@/components/ops/OpsShell";
import { KindPill, OpsAvatar, OpsBadge, OpsKicker, OpsPanel } from "@/components/ops/OpsUi";
import { kindLabel, opsPost } from "@/lib/ops-data";
import { opsHref } from "@/lib/ops-path";
import { compactCount, timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function OpsPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await opsPost(id);
  if (!data) notFound();
  const { post, author, comments } = data;

  return (
    <>
      <OpsTitle
        kicker={kindLabel(post.kind)}
        title={post.title}
        extra={
          <a href={post.href} className="ops-btn">
            Open on site
          </a>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <OpsPanel className="overflow-hidden p-0">
          {post.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.coverImage} alt="" className="max-h-[420px] w-full object-cover" />
          ) : post.videoUrl ? (
            <video src={post.videoUrl} controls className="max-h-[420px] w-full bg-black" />
          ) : null}
          <div className="px-6 py-6">
            <div className="flex flex-wrap gap-2">
              <KindPill kind={post.kind} />
              {post.hidden ? <OpsBadge tone="danger">Held off feed</OpsBadge> : <OpsBadge tone="ok">On feed</OpsBadge>}
            </div>
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-[#e7e1d8]">{post.body || "No caption."}</p>
            {post.hidden ? (
              <p className="mt-4 text-sm text-[#f0c27a]">{post.hiddenReason || "Removed from the public feed."}</p>
            ) : null}
            <div className="mt-6">
              <PostModButtons id={post.id} hidden={post.hidden} nextHref={opsHref("/content")} />
            </div>
          </div>
        </OpsPanel>
        <div className="space-y-4">
          <OpsPanel>
            <OpsKicker>Author</OpsKicker>
            {author ? (
              <a href={opsHref(`/people/${author.id}`)} className="mt-3 flex items-center gap-3">
                <OpsAvatar src={author.avatarUrl} name={author.name} size={48} />
                <span>
                  <span className="block font-bold">{author.name}</span>
                  <span className="block text-sm text-[#9c968c]">{author.accountStatus}</span>
                </span>
              </a>
            ) : (
              <p className="mt-2">Unknown</p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-[#1d1a16] px-3 py-3">
                <p className="text-[#9c968c]">Views</p>
                <p className="text-xl font-bold">{compactCount(post.views)}</p>
              </div>
              <div className="rounded-xl bg-[#1d1a16] px-3 py-3">
                <p className="text-[#9c968c]">Likes</p>
                <p className="text-xl font-bold">{post.likes}</p>
              </div>
              <div className="rounded-xl bg-[#1d1a16] px-3 py-3">
                <p className="text-[#9c968c]">Earned</p>
                <p className="text-xl font-bold">{post.earnLabel}</p>
              </div>
              <div className="rounded-xl bg-[#1d1a16] px-3 py-3">
                <p className="text-[#9c968c]">Posted</p>
                <p className="text-xl font-bold">{timeAgo(post.createdAt)}</p>
              </div>
            </div>
            <div className="mt-4">
              <FlagButton type="post" id={post.id} />
            </div>
          </OpsPanel>
        </div>
      </div>
      <OpsPanel className="mt-4">
        <OpsKicker>Thread</OpsKicker>
        <p className="mt-1 text-lg font-bold">{comments.length} comments on this post</p>
        <ul className="mt-4 divide-y divide-white/8">
          {comments.length === 0 ? <p className="text-sm text-[#9c968c]">No comments.</p> : null}
          {comments.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-4 py-4">
              <div className="flex min-w-0 gap-3">
                <OpsAvatar src={c.authorAvatar} name={c.authorName} />
                <div>
                  <a href={opsHref(`/people/${c.authorId}`)} className="font-semibold">
                    {c.authorName}
                  </a>
                  <p className="mt-1 text-sm leading-6">{c.body}</p>
                  <p className="mt-1 text-xs text-[#9c968c]">
                    {timeAgo(c.createdAt)} · {c.likes} likes
                  </p>
                </div>
              </div>
              <CommentDeleteButton id={c.id} />
            </li>
          ))}
        </ul>
      </OpsPanel>
    </>
  );
}
