import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { withDb } from "@/lib/store";
import { siteUrl } from "@/lib/constants";
import { ProfileView } from "@/components/ProfileView";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const data = await withDb((db) => db.users.find((u) => u.id === id));
  if (!data) return { title: "Profile not found" };
  return {
    title: data.name,
    description: data.headline || data.bio,
    alternates: { canonical: `${siteUrl()}/u/${id}` },
  };
}

export default async function PublicProfile({ params, searchParams }: Params) {
  noStore();
  const { id } = await params;
  const { tab = "posts" } = await searchParams;
  return <ProfileView id={id} tab={tab} />;
}
