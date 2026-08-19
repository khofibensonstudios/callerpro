import { EndLiveButton } from "@/components/ops/OpsActions";
import { OpsChart } from "@/components/ops/OpsChart";
import { OpsTitle } from "@/components/ops/OpsShell";
import { KindPill, OpsAvatar, OpsBadge, OpsKicker, OpsPanel, RangeTabs } from "@/components/ops/OpsUi";
import { kindLabel, opsOverview } from "@/lib/ops-data";
import { opsHref } from "@/lib/ops-path";
import { compactCount } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function OpsHomePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: raw } = await searchParams;
  const data = await opsOverview(raw);

  return (
    <>
      <OpsTitle title="Overview" extra={<p className="ops-muted text-sm">{data.rangeLabel}</p>} />
      <RangeTabs current={data.range} base="" />

      <div className="ops-panel mb-4 overflow-x-auto px-0 py-0">
        <div className="flex min-w-[640px] divide-x" style={{ borderColor: "var(--ops-line)" }}>
          {[
            ["People", compactCount(data.people), opsHref("/people")],
            ["Posts", compactCount(data.posts), opsHref("/content")],
            ["In window", compactCount(data.postsInRange), ""],
            ["Views", compactCount(data.viewsInRange), ""],
            ["Earned", data.earnLabel, opsHref("/wallet")],
            ["Live", String(data.liveNow), opsHref("/live")],
          ].map(([label, value, href]) => {
            const inner = (
              <div className="px-5 py-4">
                <p className="ops-muted text-[11px] font-semibold tracking-[0.14em] uppercase">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
            );
            return href ? (
              <a key={label} href={href} className="min-w-[120px] flex-1">
                {inner}
              </a>
            ) : (
              <div key={label} className="min-w-[120px] flex-1">
                {inner}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
        <OpsChart days={data.days} title={data.rangeLabel} />
        <OpsPanel>
          <div className="flex items-center justify-between">
            <OpsKicker>On air</OpsKicker>
            <a href={opsHref("/live")} className="text-sm font-semibold text-[#e85d04]">
              All
            </a>
          </div>
          <div className="mt-3 space-y-3">
            {data.live.length === 0 ? <p className="ops-muted text-sm">Nobody is live.</p> : null}
            {data.live.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--ops-panel-2)] px-3 py-3">
                <div className="min-w-0">
                  <OpsBadge tone="live">Live</OpsBadge>
                  <p className="mt-1 truncate font-semibold">{s.title}</p>
                  <p className="ops-muted text-sm">
                    {s.hostName} · {s.viewers} watching
                  </p>
                </div>
                <EndLiveButton id={s.id} />
              </div>
            ))}
          </div>
        </OpsPanel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <OpsPanel className="overflow-hidden p-0">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="font-bold">Performing people</p>
            <a href={opsHref("/people")} className="text-sm font-semibold text-[#e85d04]">
              All
            </a>
          </div>
          <table className="ops-table">
            <tbody>
              {data.performingPeople.map((u) => (
                <tr key={u.id}>
                  <td>
                    <a href={opsHref(`/people/${u.id}`)} className="flex items-center gap-3">
                      <OpsAvatar src={u.avatarUrl} name={u.name} />
                      <span>
                        <span className="block font-semibold">{u.name}</span>
                        <span className="ops-muted block text-xs">{u.accountStatus}</span>
                      </span>
                    </a>
                  </td>
                  <td className="ops-muted">{compactCount(u.views)} views</td>
                  <td className="ops-muted">{u.followers} fans</td>
                </tr>
              ))}
            </tbody>
          </table>
        </OpsPanel>
        <OpsPanel className="overflow-hidden p-0">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="font-bold">Performing content</p>
            <a href={opsHref("/content")} className="text-sm font-semibold text-[#e85d04]">
              All
            </a>
          </div>
          <table className="ops-table">
            <tbody>
              {data.performingPosts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <a href={opsHref(`/content/${p.id}`)} className="flex items-center gap-3">
                      {p.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.coverImage} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <KindPill kind={p.kind} />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{p.title}</span>
                        <span className="ops-muted block text-xs">
                          {p.authorName} · {kindLabel(p.kind)}
                        </span>
                      </span>
                    </a>
                  </td>
                  <td className="ops-muted">{compactCount(p.views)}</td>
                  <td className="ops-muted">{p.earnLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </OpsPanel>
      </div>
    </>
  );
}
