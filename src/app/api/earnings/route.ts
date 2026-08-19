import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { withDb } from "@/lib/store";
import { formatUsd } from "@/lib/earnings";
import { getOpsSettings } from "@/lib/ops-settings";
import { requestWithdrawal } from "@/lib/ops-data";

export function OPTIONS() {
  return options();
}

const RANGES = ["today", "yesterday", "week", "7d", "30d", "90d"] as const;
type Range = (typeof RANGES)[number];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function rangeWindow(key: Range) {
  const now = new Date();
  const today = startOfDay(now);
  if (key === "today") return { from: today, to: now };
  if (key === "yesterday") {
    const from = new Date(today);
    from.setDate(from.getDate() - 1);
    return { from, to: today };
  }
  if (key === "week") {
    const from = new Date(today);
    const day = from.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    from.setDate(from.getDate() - mondayOffset);
    return { from, to: now };
  }
  const days = key === "7d" ? 7 : key === "30d" ? 30 : 90;
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from, to: now };
}

export async function GET(req: Request) {
  const id = await userIdFromRequest(req);
  if (!id) return json({ error: "Sign in required." }, 401);
  const raw = new URL(req.url).searchParams.get("range") || "today";
  const key: Range = (RANGES as readonly string[]).includes(raw) ? (raw as Range) : "today";
  const { from, to } = rangeWindow(key);

  const threshold = (await getOpsSettings()).payoutThresholdUsd;
  const data = await withDb((db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) return null;
    const mine = db.posts.filter((p) => p.authorId === id && p.published !== false);
    const inRange = (iso: string) => {
      const t = +new Date(iso);
      return t >= +from && t < +to;
    };
    const periodLedger = db.ledger.filter((l) => l.userId === id && inRange(l.createdAt));
    const periodViews = db.views.filter((v) => mine.some((p) => p.id === v.postId) && inRange(v.createdAt));
    const earnByPost: Record<string, number> = {};
    const viewsByPost: Record<string, number> = {};
    for (const l of periodLedger) {
      if (!l.postId) continue;
      earnByPost[l.postId] = (earnByPost[l.postId] || 0) + l.micros;
    }
    for (const v of periodViews) {
      viewsByPost[v.postId] = (viewsByPost[v.postId] || 0) + 1;
    }
    const videos = mine
      .filter((p) => p.kind === "video" || p.kind === "clip")
      .map((p) => ({
        id: p.id,
        kind: p.kind,
        title: p.title,
        coverImage: p.coverImage,
        views: viewsByPost[p.id] || 0,
        earnMicros: earnByPost[p.id] || 0,
        earnLabel: formatUsd(earnByPost[p.id] || 0),
      }))
      .sort((a, b) => b.earnMicros - a.earnMicros || b.views - a.views);

    return {
      balanceMicros: user.balanceMicros,
      balanceLabel: formatUsd(user.balanceMicros),
      payoutThresholdUsd: threshold,
      range: key,
      periodEarnLabel: formatUsd(periodLedger.reduce((s, l) => s + l.micros, 0)),
      periodViews: periodViews.length,
      periodVideos: videos.filter((v) => v.views > 0 || v.earnMicros > 0).length,
      videos,
    };
  });
  if (!data) return json({ error: "Account missing." }, 404);
  return json(data);
}

export async function POST(req: Request) {
  const id = await userIdFromRequest(req);
  if (!id) return json({ error: "Sign in required." }, 401);
  const body = await req.json().catch(() => ({}));
  const method = String((body as { method?: string }).method || "");
  const res = await requestWithdrawal(id, method);
  if ("error" in res) {
    if (res.error === "threshold") return json({ error: "Balance is under the withdrawal threshold." }, 400);
    if (res.error === "pending") return json({ error: "A withdrawal is already waiting." }, 400);
    return json({ error: "Could not request that." }, 400);
  }
  return json({ ok: true, amountLabel: res.row.amountLabel });
}
