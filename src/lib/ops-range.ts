export const OPS_RANGES = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "7d", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "3m", label: "Last 3 months" },
  { id: "4m", label: "Last 4 months" },
  { id: "5m", label: "Last 5 months" },
  { id: "all", label: "All time" },
] as const;

export type OpsRangeId = (typeof OPS_RANGES)[number]["id"];

export function parseOpsRange(raw?: string | null): OpsRangeId {
  return OPS_RANGES.some((r) => r.id === raw) ? (raw as OpsRangeId) : "today";
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function opsRangeWindow(key: OpsRangeId) {
  const now = new Date();
  const today = startOfDay(now);
  if (key === "today") return { from: today, to: now, grain: "hour" as const };
  if (key === "yesterday") {
    const from = new Date(today);
    from.setDate(from.getDate() - 1);
    return { from, to: today, grain: "hour" as const };
  }
  if (key === "week") {
    const from = new Date(today);
    const day = from.getDay();
    from.setDate(from.getDate() - (day === 0 ? 6 : day - 1));
    return { from, to: now, grain: "day" as const };
  }
  if (key === "month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from, to: now, grain: "day" as const };
  }
  if (key === "all") {
    return { from: new Date(0), to: now, grain: "month" as const };
  }
  const from = new Date(today);
  if (key === "7d") from.setDate(from.getDate() - 6);
  else if (key === "30d") from.setDate(from.getDate() - 29);
  else if (key === "90d") from.setDate(from.getDate() - 89);
  else if (key === "3m") from.setMonth(from.getMonth() - 3);
  else if (key === "4m") from.setMonth(from.getMonth() - 4);
  else if (key === "5m") from.setMonth(from.getMonth() - 5);
  const span = +now - +from;
  const grain = span > 1000 * 60 * 60 * 24 * 80 ? ("week" as const) : ("day" as const);
  return { from, to: now, grain };
}

export function opsRangeLabel(id: OpsRangeId) {
  return OPS_RANGES.find((r) => r.id === id)?.label || "Today";
}
