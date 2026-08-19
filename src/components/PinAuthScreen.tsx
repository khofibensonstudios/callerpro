"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { PinPad } from "./PinPad";
import { APP_NAME } from "@/lib/constants";

type Mode = "login" | "set" | "confirm" | "created";

export function PinAuthScreen({ start = "login" }: { start?: "login" | "set" }) {
  const [mode, setMode] = useState<Mode>(start);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [callerId, setCallerId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function resetTo(next: Mode) {
    setError("");
    setPin("");
    setConfirm("");
    setMode(next);
  }

  async function finish(token: string) {
    localStorage.setItem("cp_token", token);
    window.location.assign("/messages");
  }

  async function login() {
    if (pin.length !== 4 || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "That PIN does not match an account.");
        setBusy(false);
        return;
      }
      await finish(data.token);
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  async function create() {
    if (pin.length !== 4 || pin !== confirm || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not create the account.");
        setBusy(false);
        setMode("set");
        setConfirm("");
        return;
      }
      localStorage.setItem("cp_token", data.token);
      setCallerId(data.user?.callerId || "");
      setBusy(false);
      setMode("created");
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  async function copyId() {
    if (!callerId) return;
    try {
      await navigator.clipboard.writeText(callerId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  const heading =
    mode === "login"
      ? "Enter your 4-digit PIN"
      : mode === "set"
        ? "Set a 4-digit PIN"
        : mode === "confirm"
          ? "Confirm your PIN"
          : "Your caller ID";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f6f3ee] px-6 pt-16 pb-8 text-[#141414]">
      <p className="text-center text-xs tracking-[0.22em] text-[#6f6a64] uppercase">{APP_NAME}</p>
      {mode !== "created" ? <h1 className="mt-6 text-center text-3xl font-bold tracking-tight">{heading}</h1> : null}

      <div className="mt-10 flex flex-1 flex-col">
        {mode === "created" ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="w-full max-w-[340px] rounded-[28px] bg-white px-6 py-8 shadow-[0_18px_50px_rgba(20,20,20,0.08)]">
              <p className="text-center text-[11px] font-semibold tracking-[0.2em] text-[#8a8580] uppercase">Your caller ID</p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <p className="font-mono text-[42px] font-bold tracking-[0.2em]">{callerId}</p>
                <button
                  type="button"
                  onClick={() => void copyId()}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f4f1eb] text-[#141414]"
                  aria-label="Copy caller ID"
                >
                  <Copy className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
              <p className="mt-3 text-center text-[13px] text-[#6f6a64]">{copied ? "Copied" : "People find you with this number."}</p>
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => window.location.assign("/messages")}
                  className="h-10 rounded-full bg-[#141414] px-8 text-[13px] font-semibold text-white"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        ) : (
          <PinPad
            value={mode === "confirm" ? confirm : pin}
            onChange={(next) => {
              setError("");
              if (mode === "confirm") setConfirm(next);
              else setPin(next);
            }}
          />
        )}

        {error ? <p className="mt-6 text-center text-sm text-red-700">{error}</p> : null}

        {mode !== "created" ? (
          <div className="mt-auto pt-8">
            {mode === "login" ? (
              <>
                <button
                  type="button"
                  disabled={pin.length !== 4 || busy}
                  onClick={() => void login()}
                  className="h-12 w-full rounded-full bg-[#141414] text-sm font-semibold text-white disabled:opacity-35"
                >
                  {busy ? "Please wait" : "Log in"}
                </button>
                <button
                  type="button"
                  className="mt-5 w-full text-center text-sm font-semibold text-[#141414]"
                  onClick={() => resetTo("set")}
                >
                  Create account
                </button>
              </>
            ) : null}

            {mode === "set" ? (
              <>
                <button
                  type="button"
                  disabled={pin.length !== 4}
                  onClick={() => {
                    setConfirm("");
                    setMode("confirm");
                  }}
                  className="h-12 w-full rounded-full bg-[#141414] text-sm font-semibold text-white disabled:opacity-35"
                >
                  Continue
                </button>
                <button type="button" className="mt-5 w-full text-center text-sm text-[#6f6a64]" onClick={() => resetTo("login")}>
                  Back to login
                </button>
              </>
            ) : null}

            {mode === "confirm" ? (
              <>
                <button
                  type="button"
                  disabled={confirm.length !== 4 || busy}
                  onClick={() => {
                    if (confirm !== pin) {
                      setError("Those PINs do not match. Set it again.");
                      setPin("");
                      setConfirm("");
                      setMode("set");
                      return;
                    }
                    void create();
                  }}
                  className="h-12 w-full rounded-full bg-[#141414] text-sm font-semibold text-white disabled:opacity-35"
                >
                  {busy ? "Please wait" : "Create account"}
                </button>
                <button type="button" className="mt-5 w-full text-center text-sm text-[#6f6a64]" onClick={() => resetTo("set")}>
                  Back
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
