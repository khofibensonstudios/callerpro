"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { SiteChrome } from "@/components/SiteChrome";

type VideoRow = {
  id: string;
  title: string;
  views: number;
  earnLabel: string;
  coverImage?: string;
};

type Earnings = {
  error?: string;
  balanceLabel: string;
  balanceMicros?: number;
  payoutThresholdUsd?: number;
  periodEarnLabel: string;
  periodViews: number;
  periodVideos: number;
  videos: VideoRow[];
};

const RANGES = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "This week" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
] as const;

export default function EarnPage() {
  const { user, loading: authLoading } = useAuth();
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("today");
  const [data, setData] = useState<Earnings | null>(null);
  const [fetching, setFetching] = useState(true);
  const [notice, setNotice] = useState("");
  const [payOpen, setPayOpen] = useState(false);

  const load = useCallback(async (next: typeof range) => {
    setFetching(true);
    const res = await fetch(`/api/earnings?range=${next}`, { credentials: "include" });
    const json = await res.json();
    setData(json);
    setFetching(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setFetching(false);
      return;
    }
    void load(range);
  }, [authLoading, user, range, load]);

  if (authLoading || (user && fetching && !data)) {
    return (
      <SiteChrome variant="wide">
        <div className="px-5 pt-3 pb-8">
          <h1 className="text-xl font-bold tracking-tight">Wallet</h1>
          <p className="mt-4 text-sm text-fb-muted">Loading</p>
        </div>
      </SiteChrome>
    );
  }

  if (!user || data?.error) {
    return (
      <SiteChrome variant="wide">
        <div className="px-5 pt-3 pb-8">
          <h1 className="text-xl font-bold tracking-tight">Wallet</h1>
          <p className="mt-4 text-sm">
            <Link href="/login" className="font-semibold text-accent">
              Log in
            </Link>{" "}
            to see your earnings.
          </p>
        </div>
      </SiteChrome>
    );
  }

  const empty = !data?.balanceMicros;

  return (
    <SiteChrome variant="wide">
      <div className="px-5 pt-3 pb-8">
        <h1 className="text-xl font-bold tracking-tight">Wallet</h1>

      <button
        type="button"
        onClick={() => setPayOpen(true)}
        className="mt-4 flex h-11 w-full items-center justify-between border border-black/15 bg-white px-4 text-left text-sm font-semibold"
      >
        <span>Payment method</span>
        <span className="text-xs font-medium text-fb-muted">Add</span>
      </button>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-fb-muted uppercase">Available balance</p>
          <p className="mt-1 text-4xl font-bold tracking-tight">{data?.balanceLabel ?? "$0.00"}</p>
        </div>
        <button
          type="button"
          disabled={empty}
          onClick={async () => {
            if (empty) {
              setNotice("Nothing to withdraw yet.");
              return;
            }
            const res = await fetch("/api/earnings", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
            const json = await res.json();
            setNotice(json.error || (json.ok ? `Requested ${json.amountLabel}.` : "Could not request that."));
          }}
          className="h-10 shrink-0 bg-[#141414] px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Withdraw
        </button>
      </div>
      {notice ? <p className="mt-2 text-sm text-fb-muted">{notice}</p> : null}

      <h2 className="mt-8 text-sm font-bold tracking-wide uppercase">Analytics</h2>
      <div className="mt-3 flex gap-2 overflow-x-auto hide-scroll pb-1">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${
              range === r.id ? "bg-[#141414] text-white" : "bg-white text-[#141414]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 border-y border-black/10 py-4">
        <div>
          <p className="text-[11px] font-semibold text-fb-muted">Earnings</p>
          <p className="mt-1 text-base font-bold">{fetching ? "…" : data?.periodEarnLabel}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-fb-muted">Views</p>
          <p className="mt-1 text-base font-bold">{fetching ? "…" : (data?.periodViews ?? 0).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-fb-muted">Active videos</p>
          <p className="mt-1 text-base font-bold">{fetching ? "…" : data?.periodVideos ?? 0}</p>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-bold tracking-wide uppercase">Video performance</h2>
      <p className="mt-1 text-sm text-fb-muted">Views and earnings for the selected period.</p>
      {!data?.videos?.length ? (
        <p className="mt-4 text-sm text-fb-muted">No videos yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-black/10">
          {data.videos.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              {p.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverImage} alt="" className="h-14 w-10 shrink-0 object-cover" />
              ) : (
                <span className="grid h-14 w-10 shrink-0 place-items-center bg-black/10 text-[10px]">Video</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{p.title}</span>
                <span className="block text-xs text-fb-muted">{p.views.toLocaleString()} views</span>
              </span>
              <span className="shrink-0 text-sm font-bold">{p.earnLabel}</span>
            </li>
          ))}
        </ul>
      )}
      {payOpen
        ? createPortal(
            <div className="fixed inset-0 z-[400] flex items-end bg-black/40" onClick={() => setPayOpen(false)}>
              <div
                className="w-full rounded-t-2xl bg-[#f4f1eb] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/20" />
                <p className="text-base font-semibold">Payment method</p>
                <p className="mt-2 text-sm text-fb-muted">
                  Choose how you want to receive withdrawals. Full setup comes next.
                </p>
                <button
                  type="button"
                  onClick={() => setPayOpen(false)}
                  className="mt-4 h-11 w-full bg-[#141414] text-sm font-semibold text-white"
                >
                  Close
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      </div>
    </SiteChrome>
  );
}
