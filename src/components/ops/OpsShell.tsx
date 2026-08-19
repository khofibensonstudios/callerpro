import { opsLogoutAction } from "@/app/ops/login/actions";
import { OpsNav } from "@/components/ops/OpsNav";
import { opsHref } from "@/lib/ops-path";
import type { OpsAlert } from "@/lib/ops-data";
import { Bell, Bot, Radio, Search, ShieldAlert } from "lucide-react";

export type OpsHeader = {
  pendingShops: number;
  liveNow: number;
  openReports: number;
  robotFiltered: number;
  hidden: number;
  alerts: OpsAlert[];
  notices: { id: string; action: string; detail: string; createdAt: string }[];
};

export function OpsShell({ children, header }: { children: React.ReactNode; header: OpsHeader }) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col border-r px-3 py-6" style={{ borderColor: "var(--ops-line)", background: "var(--ops-side)" }}>
        <p className="px-3 text-[11px] font-bold tracking-[0.22em] text-[var(--ops-muted)] uppercase">Control center</p>
        <OpsNav
          counts={{
            pendingShops: header.pendingShops,
            liveNow: header.liveNow,
            openReports: header.openReports,
          }}
        />
        <form action={opsLogoutAction} className="px-3 pt-4">
          <button type="submit" className="text-sm font-semibold text-[var(--ops-danger)]">
            Sign out
          </button>
        </form>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b px-6 py-3 backdrop-blur-md lg:px-10"
          style={{ borderColor: "var(--ops-line)", background: "var(--ops-head)" }}
        >
          <form action={opsHref("/people")} className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ops-muted)]" />
            <input name="q" placeholder="Search people" className="h-10 w-full rounded-full border pr-4 pl-10 text-sm" />
          </form>
          <a href={opsHref("/live")} className="ops-chip">
            <Radio size={14} />
            Live{header.liveNow ? ` ${header.liveNow}` : ""}
          </a>
          <a href={opsHref("/reports")} className="ops-chip">
            <ShieldAlert size={14} />
            Alerts{header.openReports ? ` ${header.openReports}` : ""}
          </a>
          <a href={opsHref("/robots")} className="ops-chip">
            <Bot size={14} />
            Robots{header.robotFiltered ? ` ${header.robotFiltered}` : ""}
          </a>
          <details className="relative">
            <summary className="ops-chip cursor-pointer">
              <Bell size={14} />
              {header.alerts.length + header.notices.length || ""}
            </summary>
            <div className="ops-panel absolute right-0 z-30 mt-2 w-80 p-3 shadow-xl">
              <ul className="ops-nav-scroll max-h-80 overflow-y-auto">
                {header.alerts.map((a) => (
                  <li key={a.id}>
                    <a href={opsHref(a.href)} className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--ops-panel-2)]">
                      <p className="font-semibold">{a.title}</p>
                      {a.detail ? <p className="ops-muted text-xs">{a.detail}</p> : null}
                    </a>
                  </li>
                ))}
                {header.notices.map((n) => (
                  <li key={n.id} className="px-3 py-2 text-sm">
                    <p className="font-semibold">{n.action}</p>
                    <p className="ops-muted text-xs">{n.detail}</p>
                  </li>
                ))}
                {header.alerts.length === 0 && header.notices.length === 0 ? (
                  <li className="ops-muted px-3 py-4 text-sm">Nothing waiting.</li>
                ) : null}
              </ul>
            </div>
          </details>
        </header>
        <main className="min-w-0 flex-1 px-6 py-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

export function OpsTitle({
  title,
  extra,
}: {
  kicker?: string;
  title: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {extra}
    </div>
  );
}

export function OpsCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`ops-panel px-5 py-5 ${className}`}>{children}</div>;
}
