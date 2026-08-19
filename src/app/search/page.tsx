"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SiteChrome } from "@/components/SiteChrome";
import { Avatar } from "@/components/Avatar";
import type { PublicUser } from "@/lib/types";

function SearchInner() {
  const params = useSearchParams();
  const q = params.get("q") || "";
  const [people, setPeople] = useState<PublicUser[]>([]);

  useEffect(() => {
    const url = `/api/search?q=${encodeURIComponent(q)}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setPeople(d.people ?? []));
  }, [q]);

  return (
    <SiteChrome variant="wide">
      <form action="/search" className="mb-4">
        <input
          name="q"
          defaultValue={q}
          autoFocus
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Search by 6-digit caller ID"
          className="h-12 w-full rounded-2xl bg-white px-4 shadow-sm outline-none"
        />
      </form>
      <div className="space-y-3">
        <h2 className="font-semibold">People</h2>
        {!q ? (
          <p className="text-sm text-fb-muted">Enter a 6-digit caller ID to find someone.</p>
        ) : people.length === 0 ? (
          <p className="text-sm text-fb-muted">No account with that caller ID.</p>
        ) : (
          people.map((p) => (
            <Link key={p.id} href={`/u/${p.id}`} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              <Avatar name={p.name} hue={p.avatarHue} src={p.avatarUrl} size={56} userId={p.id} />
              <div className="min-w-0">
                <p className="font-semibold tracking-[0.12em]">{p.callerId || p.name}</p>
                <p className="text-sm text-fb-muted">Caller ID</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </SiteChrome>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}
