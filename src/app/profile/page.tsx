import { redirect } from "next/navigation";
import { sessionUserId } from "@/lib/auth";
import { ProfileView } from "@/components/ProfileView";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const id = await sessionUserId();
  if (!id) redirect("/login?next=/profile");
  const { tab } = await searchParams;
  return <ProfileView id={id} tab={tab} />;
}
