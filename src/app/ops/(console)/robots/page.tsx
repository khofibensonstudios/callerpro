import { OpsTitle } from "@/components/ops/OpsShell";
import { OpsBadge, OpsPanel } from "@/components/ops/OpsUi";
import { opsRobotFleet } from "@/lib/ops-data";
import { opsHref } from "@/lib/ops-path";

export const dynamic = "force-dynamic";

export default async function OpsRobotsPage() {
  const data = await opsRobotFleet();
  return (
    <>
      <OpsTitle
        title="Robots"
        extra={
          <a href={opsHref("/settings")} className="ops-btn">
            Train in Settings
          </a>
        }
      />
      <p className="ops-muted mb-5 max-w-2xl text-sm leading-6">
        These filters run on the words and rules you set. They do not invent reports. Turn them on or off and add watched words in Settings.
      </p>
      <div className="overflow-hidden">
        <table className="ops-table ops-panel overflow-hidden">
          <thead>
            <tr>
              <th>Robot</th>
              <th>State</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {data.robots.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold">{r.name}</td>
                <td>
                  <OpsBadge tone={r.on ? "ok" : "mute"}>{r.on ? "On" : "Off"}</OpsBadge>
                </td>
                <td className="ops-muted">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <OpsPanel className="mt-4">
        <p className="font-bold">Watched words</p>
        <p className="ops-muted mt-2 text-sm leading-6">
          {data.wordCount
            ? `${data.wordCount} words loaded from Settings. Matching comments appear under Comments. Matching posts can be held if auto-hold is on.`
            : "No watched words yet. Open Settings and add the language you want filtered."}
        </p>
      </OpsPanel>
    </>
  );
}
