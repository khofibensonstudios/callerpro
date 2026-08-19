"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Avatar } from "./Avatar";
import { AdSlot } from "./AdSlot";
import { formatUsd } from "@/lib/earnings";

export type FeedItem = {
  post: {
    id: string;
    body: string;
    skill: string;
    viewCount: number;
    earnMicros: number;
    createdAt: string;
  };
  author: {
    id: string;
    name: string;
    headline: string;
    avatarHue: number;
    avatarUrl?: string;
  };
};

function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - +new Date(iso)) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function FeedList({ items }: { items: FeedItem[] }) {
  useEffect(() => {
    const timers = items.map((item, i) =>
      window.setTimeout(() => {
        fetch(`/api/posts/${item.post.id}/view`, { method: "POST" });
      }, 800 + i * 120),
    );
    return () => timers.forEach(clearTimeout);
  }, [items]);

  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <article key={item.post.id}>
          {i > 0 && i % 3 === 0 ? <AdSlot /> : null}
          <div className="rounded-[28px] bg-white p-5 shadow-[0_12px_40px_rgba(20,23,17,0.06)]">
            <div className="flex items-start gap-3">
              <Avatar name={item.author.name} hue={item.author.avatarHue} src={item.author.avatarUrl} userId={item.author.id} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Link href={`/u/${item.author.id}`} className="font-semibold">
                    {item.author.name}
                  </Link>
                  <span className="text-sm text-ink/45">{timeAgo(item.post.createdAt)}</span>
                </div>
                <p className="truncate text-sm text-ink/55">{item.author.headline}</p>
              </div>
              <span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-medium text-moss">
                {item.post.skill}
              </span>
            </div>
            <p className="mt-4 text-[17px] leading-7">{item.post.body}</p>
            <div className="mt-4 flex gap-4 text-sm text-ink/55">
              <span>{item.post.viewCount.toLocaleString()} views</span>
              <span className="text-moss">{formatUsd(item.post.earnMicros)} earned</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
