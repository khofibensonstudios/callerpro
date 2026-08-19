import { ReportButtons } from "@/components/ops/OpsActions";
import { OpsTitle } from "@/components/ops/OpsShell";
import { OpsBadge, OpsEmpty, OpsTable, statusTone } from "@/components/ops/OpsUi";
import { hydrateReports, listReports } from "@/lib/ops-data";
import { opsHref } from "@/lib/ops-path";
import { timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

const TABS = ["open", "reviewing", "resolved", "dismissed", "all"] as const;

export default async function OpsReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: raw } = await searchParams;
  const status = TABS.includes(raw as (typeof TABS)[number]) ? (raw as (typeof TABS)[number]) : "open";
  const reports = await hydrateReports(await listReports(status === "all" ? "all" : status));

  return (
    <>
      <OpsTitle title="Reports" extra={<p className="ops-muted text-sm">{reports.length} in this list</p>} />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <a key={tab} href={opsHref(`/reports?status=${tab}`)} className={`ops-chip capitalize ${status === tab ? "ops-chip-on" : ""}`}>
            {tab}
          </a>
        ))}
      </div>
      {reports.length === 0 ? (
        <OpsEmpty
          title="No reports here"
          body="This list stays empty until a member flags something or you open a case from a person or a post. Robots do not invent cases."
        />
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <th>Target</th>
              <th>From</th>
              <th>Status</th>
              <th>Why</th>
              <th>When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>
                  <a href={opsHref(r.href)} className="font-semibold">
                    {r.title}
                  </a>
                  <p className="ops-muted text-xs capitalize">{r.targetType}</p>
                </td>
                <td>
                  <OpsBadge tone={r.source === "robot" ? "robot" : "mute"}>{r.sourceLabel}</OpsBadge>
                </td>
                <td>
                  <OpsBadge tone={statusTone(r.status)}>{r.status}</OpsBadge>
                </td>
                <td className="max-w-sm">
                  <p>{r.reason}</p>
                  {r.preview && r.preview !== r.reason ? <p className="ops-muted mt-1 text-xs">{r.preview}</p> : null}
                </td>
                <td className="ops-muted">{timeAgo(r.createdAt)}</td>
                <td>
                  <ReportButtons id={r.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </OpsTable>
      )}
    </>
  );
}
