import { notFound } from "next/navigation";
import { FlagButton, UserStatusButtons, WalletAdjustForm } from "@/components/ops/OpsActions";
import { OpsTitle } from "@/components/ops/OpsShell";
import { KindPill, OpsAvatar, OpsBadge, OpsKicker, OpsPanel, statusTone } from "@/components/ops/OpsUi";
import { opsUser } from "@/lib/ops-data";
import { opsHref } from "@/lib/ops-path";
import { formatMoney } from "@/lib/shop-shared";
import { compactCount, timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function OpsPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await opsUser(id);
  if (!data) notFound();
  const { user } = data;

  return (
    <>
      <OpsTitle
        kicker="Dossier"
        title={user.name}
        extra={
          <a href={`/u/${user.id}`} className="ops-btn">
            Public profile
          </a>
        }
      />

      <div className="ops-panel overflow-hidden p-0">
        <div className="relative h-44 bg-[#1d1a16]">
          {user.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-[#171512] to-transparent" />
        </div>
        <div className="relative -mt-12 px-6 pb-6">
          <OpsAvatar src={user.avatarUrl} name={user.name} size={88} />
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold">{user.name}</h2>
                <OpsBadge tone={statusTone(user.accountStatus)}>{user.accountStatus}</OpsBadge>
                {data.settings.privateAccount ? <OpsBadge>Private</OpsBadge> : null}
                {data.settings.verifyRequested ? <OpsBadge tone="warn">Verify asked</OpsBadge> : null}
              </div>
              <p className="mt-1 text-sm text-[#9c968c]">{user.email}</p>
              <p className="mt-1 font-mono text-xs text-[#6f6a64]">{user.id}</p>
              {user.headline ? <p className="mt-3 max-w-2xl text-[15px]">{user.headline}</p> : null}
              {data.bio ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[#cfc8bf]">{data.bio}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {user.skills.map((s) => (
                  <OpsBadge key={s}>{s}</OpsBadge>
                ))}
                {user.formats.map((f) => (
                  <KindPill key={f} kind={f} />
                ))}
              </div>
              {user.statusReason ? <p className="mt-3 text-sm text-[#f0c27a]">Hold reason: {user.statusReason}</p> : null}
            </div>
            <div className="flex flex-col items-end gap-3">
              <UserStatusButtons id={user.id} status={user.accountStatus} />
              <FlagButton type="user" id={user.id} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Posts", String(data.posts.length)],
          ["Views in", compactCount(data.viewsReceived)],
          ["Likes", compactCount(data.likesReceived)],
          ["Comments", String(data.comments.length)],
          ["Followers", compactCount(data.followers)],
          ["Following", compactCount(data.following)],
          ["Wallet", user.balanceLabel],
          ["Last active", timeAgo(data.lastActive)],
        ].map(([label, value]) => (
          <div key={label} className="ops-panel px-4 py-4">
            <OpsKicker>{label}</OpsKicker>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <OpsPanel>
          <OpsKicker>Published work</OpsKicker>
          <p className="mt-1 text-lg font-bold">
            {data.kinds.video} videos · {data.kinds.clip} reels · {data.kinds.note} photos · {data.kinds.blog} blogs
            {data.hiddenCount ? ` · ${data.hiddenCount} held` : ""}
          </p>
          {data.posts.length === 0 ? <p className="mt-4 text-sm text-[#9c968c]">This person has not posted.</p> : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.posts.slice(0, 12).map((p) => (
              <a key={p.id} href={opsHref(`/content/${p.id}`)} className="overflow-hidden rounded-2xl bg-[#1d1a16]">
                {p.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverImage} alt="" className="h-28 w-full object-cover" />
                ) : (
                  <div className="grid h-28 place-items-center text-xs font-bold uppercase text-[#9c968c]">{p.kind}</div>
                )}
                <div className="px-3 py-2">
                  <p className="truncate font-semibold">{p.title}</p>
                  <p className="text-xs text-[#9c968c]">
                    {compactCount(p.views)} views · {p.likes} likes {p.hidden ? "· held" : ""}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </OpsPanel>
        <div className="space-y-4">
          <OpsPanel>
            <OpsKicker>Wallet</OpsKicker>
            <p className="mt-2 text-4xl font-bold">{user.balanceLabel}</p>
            <p className="mt-1 text-sm text-[#9c968c]">Lifetime {user.lifetimeLabel}</p>
            <WalletAdjustForm id={user.id} />
            <ul className="mt-4 divide-y divide-white/8 text-sm">
              {data.ledger.slice(0, 8).map((l) => (
                <li key={l.id} className="flex justify-between py-2">
                  <span className="capitalize">{l.source}</span>
                  <span className="text-[#9c968c]">
                    {l.amount} · {timeAgo(l.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </OpsPanel>
          <OpsPanel>
            <OpsKicker>Privacy</OpsKicker>
            <p className="mt-2 text-sm leading-6 text-[#cfc8bf]">
              Direct messages are sealed. This desk cannot open chats. This person has {data.conversations} private
              conversations on the platform.
            </p>
            <p className="mt-3 text-sm text-[#9c968c]">
              Followers {data.settings.followWho} · blocks out {data.blockedOut} · blocked by {data.blockedIn} · watched{" "}
              {compactCount(data.viewsGiven)} posts
            </p>
          </OpsPanel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <OpsPanel>
          <OpsKicker>Followers</OpsKicker>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.followerPeople.length === 0 ? <p className="text-sm text-[#9c968c]">No followers yet.</p> : null}
            {data.followerPeople.map((p) =>
              p ? (
                <a key={p.id} href={opsHref(`/people/${p.id}`)} className="flex items-center gap-2 rounded-full bg-[#1d1a16] py-1 pr-3 pl-1">
                  <OpsAvatar src={p.avatarUrl} name={p.name} size={28} />
                  <span className="text-sm font-semibold">{p.name}</span>
                </a>
              ) : null,
            )}
          </div>
        </OpsPanel>
        <OpsPanel>
          <OpsKicker>Following</OpsKicker>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.followingPeople.length === 0 ? <p className="text-sm text-[#9c968c]">Not following anyone.</p> : null}
            {data.followingPeople.map((p) =>
              p ? (
                <a key={p.id} href={opsHref(`/people/${p.id}`)} className="flex items-center gap-2 rounded-full bg-[#1d1a16] py-1 pr-3 pl-1">
                  <OpsAvatar src={p.avatarUrl} name={p.name} size={28} />
                  <span className="text-sm font-semibold">{p.name}</span>
                </a>
              ) : null,
            )}
          </div>
        </OpsPanel>
      </div>

      <OpsPanel className="mt-4">
        <OpsKicker>Comments they wrote</OpsKicker>
        {data.comments.length === 0 ? <p className="mt-3 text-sm text-[#9c968c]">No comments.</p> : null}
        <ul className="mt-3 divide-y divide-white/8">
          {data.comments.map((c) => (
            <li key={c.id} className="py-3">
              <a href={opsHref(`/content/${c.postId}`)} className="text-xs font-semibold text-[#e85d04]">
                {c.postTitle}
              </a>
              <p className="mt-1 text-sm">{c.body}</p>
              <p className="mt-1 text-xs text-[#9c968c]">
                {timeAgo(c.createdAt)} · {c.likes} likes
              </p>
            </li>
          ))}
        </ul>
      </OpsPanel>

      {data.shop ? (
        <OpsPanel className="mt-4">
          <div className="flex items-center justify-between">
            <div>
              <OpsKicker>Shop · {data.shop.status}</OpsKicker>
              <p className="mt-1 text-lg font-bold">{data.shop.name}</p>
            </div>
            <a href={opsHref(`/shops/${user.id}`)} className="ops-btn">
              Open shop
            </a>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.products.map((p) => (
              <li key={p.id} className="flex justify-between rounded-xl bg-[#1d1a16] px-3 py-2 text-sm">
                <span className="font-semibold">{p.name}</span>
                <span>{formatMoney(p.priceCents)}</span>
              </li>
            ))}
          </ul>
        </OpsPanel>
      ) : null}

      {data.reports.length ? (
        <OpsPanel className="mt-4">
          <OpsKicker>Cases on this account</OpsKicker>
          <ul className="mt-3 space-y-2">
            {data.reports.map((r) => (
              <li key={r.id} className="rounded-xl bg-[#1d1a16] px-4 py-3">
                <OpsBadge tone={statusTone(r.status)}>{r.status}</OpsBadge>
                <p className="mt-2 text-sm">{r.reason}</p>
              </li>
            ))}
          </ul>
        </OpsPanel>
      ) : null}
    </>
  );
}
