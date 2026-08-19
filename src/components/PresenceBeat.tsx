"use client";

import { useEffect } from "react";
import { useAuth } from "./AuthProvider";

/** Keeps the signed-in user marked online app-wide (not only inside a DM). */
export function PresenceBeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let stop = false;

    async function beat() {
      if (stop || document.hidden) return;
      try {
        await fetch("/api/chat/presence", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } catch {
        /* ignore */
      }
    }

    void beat();
    const id = window.setInterval(() => void beat(), 30_000);
    const onVis = () => {
      if (!document.hidden) void beat();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user]);

  return null;
}
