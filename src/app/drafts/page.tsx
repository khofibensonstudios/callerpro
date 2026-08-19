"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteChrome } from "@/components/SiteChrome";

type Draft = {
  id: string;
  kind: string;
  title: string;
  coverImage?: string;
  videoUrl?: string;
  createdAt: string;
};

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  useEffect(() => {
    fetch("/api/drafts")
      .then((r) => r.json())
      .then((d) => setDrafts(d.drafts ?? []));
  }, []);

  return (
    <SiteChrome variant="page">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">Drafts</h1>
        <p className="mt-1 text-sm text-fb-muted">Saved on your account, not shown to anyone else.</p>
        {!drafts ? (
          <p className="mt-6 text-sm text-fb-muted">Loading</p>
        ) : drafts.length === 0 ? (
          <p className="mt-6 text-sm text-fb-muted">No drafts yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-black/8">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-3">
                {d.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.coverImage} alt="" className="h-16 w-12 rounded-md object-cover" />
                ) : (
                  <span className="grid h-16 w-12 place-items-center rounded-md bg-[#f4f1eb] text-xs">
                    {d.kind}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{d.title}</span>
                  <span className="block text-xs text-fb-muted">{new Date(d.createdAt).toLocaleString()}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/messages" className="mt-6 inline-block text-sm font-semibold text-accent">
          Back to chats
        </Link>
      </div>
    </SiteChrome>
  );
}
