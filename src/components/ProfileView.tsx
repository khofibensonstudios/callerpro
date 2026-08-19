import Link from "next/link";
import { Grid3x3, Clapperboard, Image as ImageIcon, Contact } from "lucide-react";
import { SiteChrome } from "@/components/SiteChrome";
import { MediaThumb } from "@/components/MediaThumb";
import { Avatar } from "@/components/Avatar";
import { unstable_noStore as noStore } from "next/cache";
import { publicUser, reloadStore, toClientPost, withDb } from "@/lib/store";
import { ProfileActions } from "@/components/ProfileActions";
import { ProfileCover, ProfilePhoto } from "@/components/ProfileHeroMedia";
import { ProfileIdentity } from "@/components/ProfileIdentity";
import { ProfilePeerBar } from "@/components/ProfilePeerBar";
import { postPath, watchHref } from "@/lib/seed-content";
import { sessionClaims, sessionUserId } from "@/lib/auth";
import { notFound } from "next/navigation";
import { defaultPortrait } from "@/lib/constants";
import { contactName, listContacts } from "@/lib/contacts";
import { isGroupThread, threadMemberIds } from "@/lib/threads";
import type { Post } from "@/lib/types";

type GroupCard = { id: string; title: string };
type SavedPerson = ReturnType<typeof publicUser> & { savedName: string };

async function loadProfile(id: string, meId: string | null) {
  return withDb((db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) return null;
    const posts = db.posts
      .filter((p) => p.authorId === id && p.published !== false && !(db.deletedIds ?? []).includes(p.id))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((p) => toClientPost(p));
    const myGroups = meId
      ? db.threads.filter((t) => isGroupThread(t) && threadMemberIds(t).includes(meId))
      : [];
    const sharedGroups: GroupCard[] = meId && meId !== id
      ? myGroups
          .filter((t) => threadMemberIds(t).includes(id))
          .map((t) => ({
            id: t.id,
            title:
              t.title ||
              threadMemberIds(t)
                .filter((uid) => uid !== meId)
                .map((uid) => contactName(db, meId, uid) || db.users.find((u) => u.id === uid)?.callerId || db.users.find((u) => u.id === uid)?.name)
                .filter(Boolean)
                .slice(0, 3)
                .join(", ") ||
              "Group",
          }))
      : myGroups.map((t) => ({ id: t.id, title: t.title || "Group" }));
    const contacts = meId === id ? listContacts(db, id) : [];
    return {
      user: publicUser(user, meId === id),
      posts,
      savedName: meId && meId !== id ? contactName(db, meId, id) : "",
      groupCount: meId === id ? myGroups.length : sharedGroups.length,
      sharedGroups,
      contacts,
    };
  });
}

export async function ProfileView({ id, tab = "posts" }: { id: string; tab?: string }) {
  noStore();
  const meId = await sessionUserId();
  let data = await loadProfile(id, meId);
  if (!data) {
    await reloadStore();
    data = await loadProfile(id, meId);
  }
  if (!data && meId === id) {
    const claims = await sessionClaims();
    const callerId = claims?.callerId;
    const stub = publicUser(
      {
        id,
        email: "",
        passwordHash: "",
        name: callerId || "You",
        callerId,
        headline: "",
        bio: "",
        skills: [],
        formats: [],
        avatarHue: 24,
        avatarUrl: callerId ? defaultPortrait(callerId) : undefined,
        balanceMicros: 0,
        lifetimeMicros: 0,
        onboarded: true,
        createdAt: new Date().toISOString(),
      },
      true,
    );
    data = {
      user: stub,
      posts: [] as Post[],
      savedName: "",
      groupCount: 0,
      sharedGroups: [] as GroupCard[],
      contacts: [] as SavedPerson[],
    };
  }
  if (!data) notFound();
  const { user, posts, savedName, groupCount, sharedGroups, contacts } = data;
  const isMe = meId === user.id;
  const videos = posts.filter((p) => (p.kind === "video" || p.kind === "clip") && p.videoUrl);
  const photos = posts.filter((p) => p.kind === "note");
  const visible = posts.filter((p) => p.kind !== "blog" && p.kind !== "story");
  const postCount = visible.length;
  const current = isMe
    ? tab === "videos" || tab === "contact"
      ? tab
      : "posts"
    : tab === "videos" || tab === "pictures"
      ? tab
      : "posts";

  const tabs = isMe
    ? [
        { id: "posts", label: "Posts", icon: Grid3x3 },
        { id: "videos", label: "Videos", icon: Clapperboard },
        { id: "contact", label: "Contact", icon: Contact },
      ]
    : [
        { id: "posts", label: "Posts", icon: Grid3x3 },
        { id: "videos", label: "Videos", icon: Clapperboard },
        { id: "pictures", label: "Pictures", icon: ImageIcon },
      ];

  const base = isMe ? "/profile" : `/u/${user.id}`;
  const num = "text-center text-[16px] font-bold tracking-tight leading-none";
  const lab = "mt-1 text-center text-[11px] font-medium leading-tight text-[#6f6a64]";

  return (
    <SiteChrome variant="wide">
      <div className="overflow-hidden bg-white">
        <ProfileCover isMe={isMe} hue={user.avatarHue} coverUrl={user.coverUrl} />
        <div className="px-4 pb-4 md:px-10">
          <div className="-mt-12 flex items-end gap-6 md:gap-10">
            <div className="shrink-0 rounded-full ring-4 ring-white">
              <ProfilePhoto isMe={isMe} name={savedName || user.callerId || user.name} hue={user.avatarHue} avatarUrl={user.avatarUrl} userId={user.id} />
            </div>
            {isMe ? (
              <div className="grid min-w-0 flex-1 grid-cols-3 pb-1">
                <Link href="/groups" className={num}>
                  {groupCount}
                </Link>
                <Link href="/profile?tab=contact" prefetch={false} className={num}>
                  {contacts.length}
                </Link>
                <Link href="/profile" prefetch={false} className={num}>
                  {postCount}
                </Link>
                <Link href="/groups" className={lab}>
                  groups
                </Link>
                <Link href="/profile?tab=contact" prefetch={false} className={lab}>
                  contact
                </Link>
                <Link href="/profile" prefetch={false} className={lab}>
                  posts
                </Link>
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <ProfilePeerBar
                  profileId={user.id}
                  person={{
                    id: user.id,
                    name: savedName || user.callerId || user.name,
                    avatarHue: user.avatarHue,
                    avatarUrl: user.avatarUrl,
                    callerId: user.callerId,
                  }}
                  groups={sharedGroups}
                />
              </div>
            )}
          </div>
          <div className="mt-4">
            <ProfileIdentity isMe={isMe} userId={user.id} callerId={user.callerId} savedName={savedName} />
            {isMe ? (
              <div className="mt-4">
                <ProfileActions profileId={user.id} isMe />
              </div>
            ) : null}
          </div>
        </div>

        <nav className="mt-2 flex justify-around border-t border-black/[0.08] text-[12px] font-semibold tracking-wider text-fb-muted uppercase">
          {tabs.map((t) => {
            const Icon = t.icon;
            const on = current === t.id;
            return (
              <Link
                key={t.id}
                href={`${base}${t.id === "posts" ? "" : `?tab=${t.id}`}`}
                prefetch={false}
                className={`flex items-center gap-1.5 py-3 ${on ? "border-t-2 border-[#141414] text-[#141414]" : ""}`}
              >
                <Icon className="h-4 w-4" strokeWidth={on ? 2.4 : 2} />
                <span className="hidden sm:inline">{t.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {current === "posts" ? (
        <div className="grid grid-cols-3 gap-[2px] bg-white">
          {visible.map((post) => (
            <Link
              key={post.id}
              href={
                post.kind === "video" || post.kind === "clip" || post.kind === "note"
                  ? watchHref(post.id, { src: "profile", author: user.id })
                  : postPath(post.id, post.kind)
              }
              prefetch={false}
              className="relative aspect-square overflow-hidden bg-[#ebe6de]"
            >
              <MediaThumb post={post} playButton={post.kind === "video" || post.kind === "clip"} className="h-full w-full" />
            </Link>
          ))}
          {visible.length === 0 ? <p className="col-span-3 px-4 py-16 text-center text-sm text-fb-muted">No posts yet.</p> : null}
        </div>
      ) : null}

      {current === "videos" ? (
        videos.length ? (
          <div className="grid grid-cols-3 gap-[2px] bg-white">
            {videos.map((post) => (
              <Link
                key={post.id}
                href={watchHref(post.id, { src: "profile", author: user.id })}
                prefetch={false}
                className="relative aspect-square overflow-hidden bg-[#ebe6de]"
              >
                <MediaThumb post={post} className="h-full w-full" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-4 py-16 text-center text-sm text-fb-muted">No videos yet.</p>
        )
      ) : null}

      {current === "pictures" ? (
        <div className="grid grid-cols-3 gap-[2px] bg-white">
          {photos.map((post) => (
            <Link
              key={post.id}
              href={watchHref(post.id, { src: "profile", author: user.id })}
              prefetch={false}
              className="relative aspect-square overflow-hidden bg-[#ebe6de]"
            >
              <MediaThumb post={post} className="h-full w-full" />
            </Link>
          ))}
          {photos.length === 0 ? <p className="col-span-3 px-4 py-16 text-center text-sm text-fb-muted">No pictures yet.</p> : null}
        </div>
      ) : null}

      {current === "contact" ? (
        <div className="bg-white">
          {contacts.length ? (
            contacts.map((c) => (
              <Link key={c.id} href={`/u/${c.id}`} prefetch={false} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf8f4]">
                <Avatar name={c.savedName} hue={c.avatarHue} src={c.avatarUrl} size={48} userId={c.id} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{c.savedName}</span>
                  {c.callerId ? <span className="block font-mono text-[13px] tracking-[0.14em] text-fb-muted">{c.callerId}</span> : null}
                </span>
              </Link>
            ))
          ) : (
            <p className="px-4 py-16 text-center text-sm text-fb-muted">No contacts yet. Search a caller ID to save someone.</p>
          )}
        </div>
      ) : null}
    </SiteChrome>
  );
}
