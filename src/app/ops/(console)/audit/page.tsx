import { OpsTitle } from "@/components/ops/OpsShell";
import { OpsEmpty, OpsTable } from "@/components/ops/OpsUi";
import { listDeskActivity } from "@/lib/ops-data";
import { timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function OpsAuditPage() {
  const rows = await listDeskActivity();
  return (
    <>
      <OpsTitle title="Activity" extra={<p className="ops-muted text-sm">Control center access only</p>} />
      {rows.length === 0 ? (
        <OpsEmpty
          title="No desk events yet"
          body="Sign-ins, denied attempts, and settings changes from this control center are recorded here. Platform posts and comments are not."
        />
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <th>Event</th>
              <th>Detail</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">{r.action.replace("desk.", "")}</td>
                <td className="ops-muted">{r.detail || "—"}</td>
                <td className="ops-muted">{timeAgo(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </OpsTable>
      )}
    </>
  );
}
