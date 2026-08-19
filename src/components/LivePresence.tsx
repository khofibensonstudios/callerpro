"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type LiveMap = Record<string, string>; // userId -> sessionId

const LivePresenceContext = createContext<LiveMap>({});

export function LivePresenceProvider({ children }: { children: React.ReactNode }) {
  const [map, setMap] = useState<LiveMap>({});

  useEffect(() => {
    let stop = false;
    async function tick() {
      try {
        const res = await fetch("/api/live", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (stop) return;
        const next: LiveMap = {};
        for (const live of data.lives || []) {
          const hostId = live.hostId || live.host?.id;
          if (hostId && live.id) next[hostId] = live.id;
        }
        setMap(next);
      } catch {
        /* ignore */
      }
    }
    void tick();
    const id = window.setInterval(() => {
      if (!document.hidden) void tick();
    }, 10000);
    const onVis = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const value = useMemo(() => map, [map]);
  return <LivePresenceContext.Provider value={value}>{children}</LivePresenceContext.Provider>;
}

export function useLiveSessionId(userId?: string | null) {
  const map = useContext(LivePresenceContext);
  if (!userId) return null;
  return map[userId] || null;
}

export function useLiveMap() {
  return useContext(LivePresenceContext);
}
