import { EndLiveButton } from "@/components/ops/OpsActions";
import { OpsTitle } from "@/components/ops/OpsShell";
import { OpsAvatar, OpsBadge, OpsEmpty, OpsTable } from "@/components/ops/OpsUi";
import { opsLives } from "@/lib/ops-data";
import { opsHref } from "@/lib/ops-path";
import { timeAgo } from "@/lib/time";

export const dynamic = "force-dynamic";

function duration(start: string, end?: string) {
  const ms = Math.max(0, +new Date(end || Date.now()) - +new Date(start));
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default async function OpsLivePage() {
  const { now, recent, watching } = await opsLives();
  return (
    <>
      <OpsTitle title="Live" extra={<p className="ops-muted text-sm">{now.length} on air · {watching} watching</p>} />
      {now.length === 0 ? (
        <p className="ops-muted mb-6 text-sm">Nobody is broadcasting.</p>
      ) : (
        <div className="mb-6">
          <OpsTable>
            <thead>
              <tr>
                <th>Room</th>
                <th>Host</th>
                <th>Viewers</th>
                <th>Length</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {now.map((s) => (
                <tr key={s.id}>
                  <td>
                    <OpsBadge tone="live">Live</OpsBadge>
                    <span className="ml-2 font-semibold">{s.title}</span>
                  </td>
                  <td>
                    {s.host ? (
                      <a href={opsHref(`/people/${s.host.id}`)} className="inline-flex items-center gap-2">
                        <OpsAvatar src={s.host.avatarUrl} name={s.host.name} size={24} />
                        {s.host.name}
                      </a>
                    ) : (
                      "Host"
                    )}
                  </td>
                  <td>
                    {s.viewerCount} / peak {s.peakViewers || s.viewerCount}
                  </td>
                  <td>{duration(s.startedAt)}</td>
                  <td>
                    <div className="flex gap-2">
                      <a href={`/live/${s.id}`} className="text-sm font-semibold text-[#e85d04]">
                        Open
                      </a>
                      <EndLiveButton id={s.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </OpsTable>
        </div>
      )}
      {recent.length === 0 ? (
        <OpsEmpty title="No history" body="Ended broadcasts show here." />
      ) : (
        <OpsTable>
          <thead>
            <tr>
              <th>Title</th>
              <th>Host</th>
              <th>State</th>
              <th>Viewers</th>
              <th>Length</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold">{s.title}</td>
                <td>
                  {s.host ? (
                    <a href={opsHref(`/people/${s.host.id}`)}>{s.host.name}</a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <OpsBadge tone={s.status === "live" ? "live" : "mute"}>{s.status}</OpsBadge>
                </td>
                <td>
                  {s.viewerCount} / {s.peakViewers || s.viewerCount}
                </td>
                <td>{duration(s.startedAt, s.endedAt)}</td>
                <td className="ops-muted">{timeAgo(s.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </OpsTable>
      )}
    </>
  );
}
