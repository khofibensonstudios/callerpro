"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";

export function FriendButton({ userId }: { userId: string }) {
  const { user } = useAuth();
  const [on, setOn] = useState(false);
  if (!user || user.id === userId) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        const res = await fetch("/api/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const d = await res.json();
        if (res.ok) setOn(d.friends);
      }}
      className={`rounded-md px-4 py-2 text-sm font-semibold ${on ? "bg-fb-hover" : "bg-fb text-white"}`}
    >
      {on ? "Friends" : "Add friend"}
    </button>
  );
}
