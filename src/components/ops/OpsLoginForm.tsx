"use client";

import { useActionState } from "react";
import { opsLoginAction, type OpsLoginState } from "@/app/ops/login/actions";

export function OpsLoginForm() {
  const [state, action, pending] = useActionState(opsLoginAction, null as OpsLoginState);

  return (
    <form action={action} className="mt-10 space-y-7">
      <label className="block">
        <span className="text-[11px] font-semibold tracking-[0.16em] text-[#9c968c] uppercase">Identity</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="mt-2 h-12 w-full border-0 border-b border-white/20 bg-transparent text-lg outline-none transition focus:border-[#e85d04]"
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-semibold tracking-[0.16em] text-[#9c968c] uppercase">Passphrase</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 h-12 w-full border-0 border-b border-white/20 bg-transparent text-lg outline-none transition focus:border-[#e85d04]"
        />
      </label>
      {state?.error ? <p className="text-sm text-[#ff7a68]">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="ops-btn ops-btn-primary h-12 w-full"
      >
        {pending ? "Checking" : "Enter"}
      </button>
    </form>
  );
}
