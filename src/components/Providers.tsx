"use client";

import { Suspense, useEffect } from "react";
import { AuthProvider, type AuthUser } from "./AuthProvider";
import { InAppNotify } from "./InAppNotify";
import { PresenceBeat } from "./PresenceBeat";
import { CartProvider } from "./shop/CartProvider";
import { FeedAudioGuard } from "./FeedAudioGuard";
import { CallSessionProvider } from "./CallSession";
import { applyTheme } from "@/lib/settings";

export function Providers({
  children,
  user,
}: {
  children: React.ReactNode;
  user: AuthUser | null;
}) {
  useEffect(() => {
    try {
      const t = localStorage.getItem("cp_theme");
      if (t === "dark" || t === "light") applyTheme(t);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    function noisy(value: unknown) {
      const msg = String((value as { message?: string })?.message || value || "");
      return /WritableStream|ReadableStream|closing or closed|already closed|InvalidStateError/i.test(msg);
    }
    function hideNextOverlay() {
      document.querySelectorAll("nextjs-portal").forEach((el) => {
        const text = el.shadowRoot?.textContent || el.textContent || "";
        if (noisy(text)) el.remove();
      });
    }
    function onError(e: ErrorEvent) {
      if (noisy(e.error) || noisy(e.message)) {
        e.preventDefault();
        hideNextOverlay();
      }
    }
    function onReject(e: PromiseRejectionEvent) {
      if (noisy(e.reason)) {
        e.preventDefault();
        hideNextOverlay();
      }
    }
    const log = console.error;
    console.error = (...args: unknown[]) => {
      if (args.some((a) => noisy(a))) {
        hideNextOverlay();
        return;
      }
      log.apply(console, args);
    };
    const watch = new MutationObserver(hideNextOverlay);
    watch.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      console.error = log;
      watch.disconnect();
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, []);

  return (
    <AuthProvider initialUser={user}>
      <CartProvider>
        <PresenceBeat />
        <Suspense fallback={null}>
          <FeedAudioGuard />
        </Suspense>
        <CallSessionProvider>
          {children}
          <Suspense fallback={null}>
            <InAppNotify />
          </Suspense>
        </CallSessionProvider>
      </CartProvider>
    </AuthProvider>
  );
}
