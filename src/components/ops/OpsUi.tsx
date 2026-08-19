import { opsHref } from "@/lib/ops-path";

function kindLabel(kind: string) {
  if (kind === "note") return "Photo";
  if (kind === "clip") return "Reel";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function OpsPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`ops-panel px-5 py-5 ${className}`}>{children}</div>;
}

export function OpsKicker({ children }: { children: React.ReactNode }) {
  return <p className="ops-muted text-[11px] font-semibold tracking-[0.16em] uppercase">{children}</p>;
}

export function OpsAvatar({ src, name, size = 36 }: { src?: string; name: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src || ""}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size, background: "var(--ops-panel-2)" }}
    />
  );
}

export function OpsBadge({
  children,
  tone = "mute",
}: {
  children: React.ReactNode;
  tone?: "mute" | "live" | "warn" | "ok" | "danger" | "robot";
}) {
  const cls =
    tone === "live"
      ? "ops-badge-live"
      : tone === "warn"
        ? "ops-badge-warn"
        : tone === "ok"
          ? "ops-badge-ok"
          : tone === "danger"
            ? "ops-badge-danger"
            : tone === "robot"
              ? "ops-badge-robot"
              : "";
  return <span className={`ops-badge ${cls}`}>{children}</span>;
}

export function OpsEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="ops-panel px-8 py-14 text-center">
      <p className="text-lg font-bold tracking-tight">{title}</p>
      <p className="ops-muted mx-auto mt-2 max-w-md text-sm leading-6">{body}</p>
    </div>
  );
}

export function statusTone(status: string): "ok" | "warn" | "danger" | "mute" {
  if (status === "active" || status === "verified" || status === "resolved" || status === "paid") return "ok";
  if (status === "pending" || status === "reviewing" || status === "suspended") return "warn";
  if (status === "banned" || status === "rejected" || status === "hidden") return "danger";
  return "mute";
}

export function KindPill({ kind }: { kind: string }) {
  return <OpsBadge>{kindLabel(kind)}</OpsBadge>;
}

export function OpsTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="ops-panel overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="ops-table">{children}</table>
      </div>
    </div>
  );
}

export function RangeTabs({
  current,
  base,
}: {
  current: string;
  base: string;
}) {
  const ranges = [
    ["today", "Today"],
    ["yesterday", "Yesterday"],
    ["week", "This week"],
    ["7d", "Last 7 days"],
    ["month", "This month"],
    ["30d", "Last 30 days"],
    ["90d", "Last 90 days"],
    ["3m", "3 months"],
    ["4m", "4 months"],
    ["5m", "5 months"],
    ["all", "All time"],
  ];
  const join = base.includes("?") ? "&" : "?";
  return (
    <div className="mb-5 flex flex-wrap gap-1.5">
      {ranges.map(([id, label]) => (
        <a key={id} href={opsHref(`${base || ""}${join}range=${id}`)} className={`ops-chip ${current === id ? "ops-chip-on" : ""}`}>
          {label}
        </a>
      ))}
    </div>
  );
}
