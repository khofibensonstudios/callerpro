import { OpsTitle } from "@/components/ops/OpsShell";
import { OpsAvatar, OpsBadge, OpsEmpty, OpsTable, statusTone } from "@/components/ops/OpsUi";
import { opsPeoplePulse, opsUsers } from "@/lib/ops-data";
import { opsHref } from "@/lib/ops-path";
import { compactCount, timeAgo } from "@/lib/time";
import type { AccountStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const TABS: { id: "all" | AccountStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Suspended" },
  { id: "banned", label: "Banned" },
];

const SORTS = [
  { id: "performance", label: "Performance" },
  { id: "new", label: "Newest" },
  { id: "wallet", label: "Wallet" },
] as const;

export default async function OpsPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}) {
  const { q = "", status: raw, sort: sortRaw } = await searchParams;
  const status = raw === "active" || raw === "suspended" || raw === "banned" ? raw : "all";
  const sort = sortRaw === "new" || sortRaw === "wallet" ? sortRaw : "performance";
  const [people, pulse] = await Promise.all([opsUsers(q, status, sort), opsPeoplePulse()]);
  const qs = (next: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { q, status, sort, ...next };
    if (merged.q) p.set("q", merged.q);
    if (merged.status !== "all") p.set("status", merged.status);
    if (merged.sort !== "performance") p.set("sort", merged.sort);
    const s = p.toString();
    return opsHref(s ? `/people?${s}` : "/people");
  };

  return (
    <>
      <OpsTitle title="People" extra={<p className="ops-muted text-sm">{people.length} shown · {pulse.total} total</p>} />
      <form action={opsHref("/people")} className="mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Name, email, id" className="h-10 min-w-[220px] flex-1 rounded-full border px-4" />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="sort" value={sort} />
        <button className="ops-btn ops-btn-primary">Search</button>
      </form>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <a key={tab.id} href={qs({ status: tab.id })} className={`ops-chip ${status === tab.id ? "ops-chip-on" : ""}`}>
            {tab.label}
          </a>
        ))}
        <span className="mx-2 h-8 w-px bg-[var(--ops-line)]" />
        {SORTS.map((tab) => (
          <a key={tab.id} href={qs({ sort: tab.id })} className={`ops-chip ${sort === tab.id ? "ops-chip-on" : ""}`}>
            {tab.label}
          </a>
        ))}
      </div>
      {people.length === 0 ? (
        <OpsEmpty title="Nobody in this list" body="Change filters or search." />
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <th>Person</th>
              <th>Status</th>
              <th>Posts</th>
              <th>Views</th>
              <th>Fans</th>
              <th>Wallet</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {people.map((u) => (
              <tr key={u.id}>
                <td>
                  <a href={opsHref(`/people/${u.id}`)} className="flex items-center gap-3">
                    <OpsAvatar src={u.avatarUrl} name={u.name} />
                    <span>
                      <span className="block font-semibold">{u.name}</span>
                      <span className="ops-muted block text-xs">{u.email}</span>
                    </span>
                  </a>
                </td>
                <td>
                  <OpsBadge tone={statusTone(u.accountStatus)}>{u.accountStatus}</OpsBadge>
                </td>
                <td>{u.posts}</td>
                <td>{compactCount(u.views)}</td>
                <td>{u.followers}</td>
                <td>{u.balanceLabel}</td>
                <td className="ops-muted">{timeAgo(u.lastActive)}</td>
              </tr>
            ))}
          </tbody>
        </OpsTable>
      )}
    </>
  );
}
