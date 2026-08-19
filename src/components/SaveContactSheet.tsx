"use client";

import { useState } from "react";

export function SaveContactSheet({
  userId,
  callerId,
  onSaved,
  onSkip,
}: {
  userId: string;
  callerId?: string;
  onSaved: (name: string) => void;
  onSkip?: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const next = name.trim();
    if (!next || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/contacts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Could not save.");
      return;
    }
    onSaved(next);
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-end bg-black/40">
      <div className="w-full rounded-t-2xl bg-white px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-base font-bold">Save this caller ID</p>
        {callerId ? <p className="mt-1 font-mono text-sm tracking-[0.18em] text-fb-muted">{callerId}</p> : null}
        <input
          autoFocus
          className="mt-4 h-12 w-full rounded-xl bg-[#f4f1eb] px-4 text-[16px] outline-none"
          placeholder="Name you want to save"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        <button
          type="button"
          disabled={!name.trim() || busy}
          onClick={() => void save()}
          className="mt-4 h-11 w-full rounded-full bg-[#141414] text-sm font-semibold text-white disabled:opacity-35"
        >
          {busy ? "Saving" : "Save"}
        </button>
        {onSkip ? (
          <button type="button" className="mt-3 w-full text-center text-sm text-fb-muted" onClick={onSkip}>
            Skip
          </button>
        ) : null}
      </div>
    </div>
  );
}
