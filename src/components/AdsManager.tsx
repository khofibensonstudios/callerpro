"use client";

import { useState } from "react";
import type { AdCampaign, UserSettings } from "@/lib/settings";

export function AdsManager({
  campaigns,
  onChange,
}: {
  campaigns: AdCampaign[];
  onChange: (next: AdCampaign[]) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [promote, setPromote] = useState<AdCampaign["promote"]>("profile");
  const [link, setLink] = useState("");
  const [budget, setBudget] = useState("10");

  function save(next: AdCampaign[]) {
    onChange(next);
  }

  function create() {
    const name = title.trim();
    const daily = Math.max(1, Number(budget) || 10);
    if (!name) return;
    if (promote === "link" && !link.trim()) return;
    const row: AdCampaign = {
      id: `ad_${crypto.randomUUID()}`,
      title: name.slice(0, 80),
      promote,
      link: promote === "link" ? link.trim().slice(0, 500) : undefined,
      dailyBudget: daily,
      status: "running",
      createdAt: new Date().toISOString(),
    };
    save([row, ...campaigns]);
    setCreating(false);
    setTitle("");
    setLink("");
    setPromote("profile");
    setBudget("10");
  }

  function setStatus(id: string, status: AdCampaign["status"]) {
    save(campaigns.map((c) => (c.id === id ? { ...c, status } : c)));
  }

  return (
    <div className="mt-6">
      <p className="text-sm leading-6 text-fb-muted">
        You run ads here. Pay to promote your profile, shop, or a link to people on Caller Pro.
      </p>
      {!creating ? (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-5 h-11 w-full rounded-xl bg-[#141414] text-sm font-semibold text-white"
        >
          Create ad
        </button>
      ) : (
        <div className="mt-5 space-y-4 rounded-xl bg-white px-4 py-4">
          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-fb-muted uppercase">Ad name</span>
            <input
              className="mt-2 h-11 w-full rounded-lg bg-[#f4f1eb] px-3 text-[15px] outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summer promo"
            />
          </label>
          <p className="text-xs font-semibold tracking-wide text-fb-muted uppercase">Promote</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["profile", "My profile"],
                ["shop", "My shop"],
                ["link", "A link"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPromote(id)}
                className={`h-9 rounded-full px-3 text-[13px] font-semibold ${
                  promote === id ? "bg-[#141414] text-white" : "bg-[#f4f1eb] text-[#141414]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {promote === "link" ? (
            <input
              className="h-11 w-full rounded-lg bg-[#f4f1eb] px-3 text-[15px] outline-none"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://"
            />
          ) : null}
          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-fb-muted uppercase">Daily budget (USD)</span>
            <input
              inputMode="numeric"
              className="mt-2 h-11 w-full rounded-lg bg-[#f4f1eb] px-3 text-[15px] outline-none"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={create}
              disabled={!title.trim() || (promote === "link" && !link.trim())}
              className="h-11 flex-1 rounded-xl bg-[#141414] text-sm font-semibold text-white disabled:opacity-35"
            >
              Start ad
            </button>
            <button type="button" onClick={() => setCreating(false)} className="h-11 px-4 text-sm font-medium text-fb-muted">
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul className="mt-5 divide-y divide-black/10 border-y border-black/10">
        {campaigns.length ? (
          campaigns.map((c) => (
            <li key={c.id} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{c.title}</span>
                  <span className="mt-0.5 block text-[13px] text-fb-muted">
                    {c.promote === "profile" ? "Profile" : c.promote === "shop" ? "Shop" : "Link"} · ${c.dailyBudget}/day ·{" "}
                    {c.status === "running" ? "Running" : c.status === "paused" ? "Paused" : "Ended"}
                  </span>
                </span>
                {c.status !== "ended" ? (
                  <button
                    type="button"
                    className="shrink-0 text-[13px] font-semibold"
                    onClick={() => setStatus(c.id, c.status === "running" ? "paused" : "running")}
                  >
                    {c.status === "running" ? "Pause" : "Resume"}
                  </button>
                ) : null}
              </div>
            </li>
          ))
        ) : (
          <li className="py-6 text-sm text-fb-muted">No ads yet. Create one to start running.</li>
        )}
      </ul>
    </div>
  );
}

export function campaignPatch(settings: UserSettings, adCampaigns: AdCampaign[]): Partial<UserSettings> {
  return { adCampaigns };
}
