"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { VoiceCallOverlay } from "./VoiceCallOverlay";
import { useAuth } from "./AuthProvider";

export type CallPerson = { id: string; name: string; avatarHue: number; avatarUrl?: string };
export type CallStart = {
  threadId: string;
  other: CallPerson;
  mode: "audio" | "video";
  incoming?: boolean;
  role?: "caller" | "callee";
};

const CallSessionContext = createContext<{
  call: CallStart | null;
  startCall: (next: CallStart) => void;
}>({
  call: null,
  startCall: () => {},
});

export function useCallSession() {
  return useContext(CallSessionContext);
}

export function CallSessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [call, setCall] = useState<CallStart | null>(null);

  const startCall = useCallback((next: CallStart) => {
    setCall(next);
  }, []);

  useEffect(() => {
    if (call || !user?.id) return;
    let stop = false;
    async function check() {
      const res = await fetch("/api/calls", { credentials: "include" });
      const d = await res.json().catch(() => ({}));
      if (stop || call) return;
      const c = d.call as
        | {
            threadId: string;
            role: "caller" | "callee";
            status: string;
            mode?: "audio" | "video";
            pending?: boolean;
            other: CallPerson | null;
          }
        | null
        | undefined;
      if (!c?.other || c.status === "ended") return;
      if (c.pending && c.role !== "caller") {
        setCall({
          threadId: c.threadId,
          role: "callee",
          incoming: true,
          mode: c.mode === "video" ? "video" : "audio",
          other: c.other,
        });
      }
    }
    void check();
    const t = window.setInterval(() => void check(), 700);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [call, user?.id]);

  return (
    <CallSessionContext.Provider value={{ call, startCall }}>
      {children}
      {call && user?.id ? (
        <VoiceCallOverlay
          threadId={call.threadId}
          meId={user.id}
          other={call.other}
          initialRole={call.role || "caller"}
          initialIncoming={call.incoming}
          initialMode={call.mode}
          onClose={() => setCall(null)}
        />
      ) : null}
    </CallSessionContext.Provider>
  );
}
