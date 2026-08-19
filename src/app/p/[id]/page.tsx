import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PostView } from "@/components/PostView";
import { SiteChrome } from "@/components/SiteChrome";
import { siteUrl } from "@/lib/constants";
import { postPath } from "@/lib/seed-content";
import { getPostBundle } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const data = await getPostBundle(id);
  if (!data) return { title: "Post not found" };
  const description = data.post.body.slice(0, 160);
  const url = `${siteUrl()}${postPath(data.post.id, data.post.kind)}`;
  return {
    title: data.post.title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
  };
}

export default async function PostPage({ params }: Params) {
  const { id } = await params;
  const data = await getPostBundle(id);
  if (!data) notFound();
  if (data.post.kind === "blog") redirect("/messages");
  const variant = "wide";
  return (
    <SiteChrome variant={variant}>
      <PostView post={data.post} author={data.author} related={data.related} />
    </SiteChrome>
  );
}
