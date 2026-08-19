"use client";

import { useEffect, useState } from "react";
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Video } from "lucide-react";
import { SiteChrome } from "@/components/SiteChrome";
import { Avatar } from "@/components/Avatar";
import { useCallSession } from "@/components/CallSession";

type Person = { id: string; name: string; avatarHue: number; avatarUrl?: string };
type Row = {
  threadId: string;
  status: string;
  mode: "audio" | "video";
  updatedAt: string;
  outgoing: boolean;
  missed: boolean;
  people: Person[];
};

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function CallsPage() {
  const { startCall } = useCallSession();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const res = await fetch("/api/calls?history=1", { credentials: "include" });
      const d = await res.json().catch(() => ({}));
      if (!stop) setRows(d.calls ?? []);
    }
    void load();
    const t = window.setInterval(() => void load(), 4000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);

  function begin(row: Row, mode: "audio" | "video") {
    const other = row.people[0];
    if (!other) return;
    startCall({ threadId: row.threadId, other, mode, incoming: false, role: "caller" });
  }

  return (
    <SiteChrome variant="chat">
      <div className="flex h-full min-h-0 flex-1 flex-col bg-white">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold tracking-tight">Calls</h1>
          <p className="mt-0.5 text-sm text-fb-muted">Audio and video</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows === null ? (
            <p className="px-4 py-8 text-sm text-fb-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-8 text-sm text-fb-muted">No calls yet. Open a chat and tap video or phone.</p>
          ) : (
            rows.map((row) => {
              const other = row.people[0];
              const label =
                row.people.length > 1
                  ? `${other?.name || "Call"} +${row.people.length - 1}`
                  : other?.name || "Call";
              const Icon = row.missed ? PhoneMissed : row.outgoing ? PhoneOutgoing : PhoneIncoming;
              return (
                <div key={`${row.threadId}-${row.updatedAt}`} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={label} hue={other?.avatarHue || 20} src={other?.avatarUrl} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${row.missed ? "text-red-600" : ""}`}>{label}</p>
                    <p className="flex items-center gap-1 text-xs text-fb-muted">
                      <Icon className="h-3.5 w-3.5" />
                      {row.mode === "video" ? "Video" : "Audio"} · {timeAgo(row.updatedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5"
                    title="Video call"
                    onClick={() => begin(row, "video")}
                  >
                    <Video className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5"
                    title="Voice call"
                    onClick={() => begin(row, "audio")}
                  >
                    <Phone className="h-5 w-5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </SiteChrome>
  );
}
