"use client";

import { useState } from "react";
import { Copy, X } from "lucide-react";
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
  const [showCard, setShowCard] = useState(false);

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
      requestAnimationFrame(() => setShowCard(true));
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
    } catch {}
  }

  const heading =
    mode === "login"
      ? "Enter your 4-digit PIN"
      : mode === "set"
        ? "Set a 4-digit PIN"
        : mode === "confirm"
          ? "Confirm your PIN"
          : "";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f6f3ee] px-6 pt-16 pb-8 text-[#141414]">
      <p className="text-center text-xs tracking-[0.22em] text-[#6f6a64] uppercase">{APP_NAME}</p>
      {mode !== "created" && <h1 className="mt-6 text-center text-3xl font-bold tracking-tight">{heading}</h1>}

      <div className="mt-10 flex flex-1 flex-col">
        {mode === "created" ? (
          /* Messages-like background with slide-up card */
          <div className="relative flex flex-1 flex-col">
            {/* Fake messages background */}
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
              <div className="h-12 w-12 rounded-full bg-[#e85d04]/10" />
              <p className="text-center text-lg font-bold">Welcome to {APP_NAME}</p>
              <p className="text-center text-sm text-[#8a8580]">Your chats will appear here</p>
            </div>

            {/* Slide-up overlay */}
            <div className={`fixed inset-0 z-50 flex items-end justify-center bg-black/40 transition-opacity duration-300 ${showCard ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              <div
                className={`w-full max-w-md transform transition-transform duration-500 ease-out ${showCard ? "translate-y-0" : "translate-y-full"}`}
              >
                <div className="rounded-t-[28px] bg-white px-6 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.12)]">
                  {/* Close / dismiss */}
                  <div className="mb-3 flex justify-center">
                    <span className="h-1 w-10 rounded-full bg-[#d1cdc7]" />
                  </div>

                  <p className="text-center text-[11px] font-semibold tracking-[0.2em] text-[#8a8580] uppercase">
                    Your caller ID
                  </p>

                  <div className="mt-5 flex items-center justify-center gap-3">
                    <p className="font-mono text-[40px] font-bold tracking-[0.18em] text-[#141414]">{callerId}</p>
                    <button
                      type="button"
                      onClick={() => void copyId()}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f4f1eb] text-[#141414] active:scale-95"
                      aria-label="Copy caller ID"
                    >
                      <Copy className="h-4.5 w-4.5" strokeWidth={2.2} />
                    </button>
                  </div>

                  <p className="mt-2 text-center text-[13px] text-[#8a8580]">
                    {copied ? "Copied!" : "Share this number so people can find you."}
                  </p>

                  <button
                    type="button"
                    onClick={() => window.location.assign("/messages")}
                    className="mt-6 h-12 w-full rounded-full bg-[#141414] text-[14px] font-semibold text-white active:scale-[0.98]"
                  >
                    Start chatting
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void copyId();
                      window.location.assign("/messages");
                    }}
                    className="mt-3 w-full text-center text-[13px] font-medium text-[#8a8580]"
                  >
                    Copy & continue
                  </button>
                </div>
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

        {mode !== "created" && (
          <div className="mt-auto pt-8">
            {mode === "login" && (
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
            )}

            {mode === "set" && (
              <>
                <button
                  type="button"
                  disabled={pin.length !== 4}
                  onClick={() => { setConfirm(""); setMode("confirm"); }}
                  className="h-12 w-full rounded-full bg-[#141414] text-sm font-semibold text-white disabled:opacity-35"
                >
                  Continue
                </button>
                <button type="button" className="mt-5 w-full text-center text-sm text-[#6f6a64]" onClick={() => resetTo("login")}>
                  Back to login
                </button>
              </>
            )}

            {mode === "confirm" && (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
