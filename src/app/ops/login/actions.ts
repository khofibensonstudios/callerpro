"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  checkOpsCredentials,
  clearOpsCookie,
  opsClearFails,
  opsClientKey,
  opsCredentialsConfigured,
  opsFail,
  opsLocked,
  opsSession,
  setOpsCookie,
  signOpsToken,
} from "@/lib/ops-auth";
import { writeDeskEvent } from "@/lib/ops-data";
import { opsHref } from "@/lib/ops-path";

export type OpsLoginState = { error: string } | null;

export async function opsLoginAction(_prev: OpsLoginState, formData: FormData): Promise<OpsLoginState> {
  const hdrs = await headers();
  const key = opsClientKey(hdrs.get("x-forwarded-for") || hdrs.get("x-real-ip"), hdrs.get("user-agent"));

  if (opsLocked(key) || !opsCredentialsConfigured()) {
    opsFail(key);
    await writeDeskEvent("login_denied", `locked or unconfigured · ${key.slice(0, 80)}`);
    return { error: "Access denied." };
  }

  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  if (!checkOpsCredentials(email, password)) {
    opsFail(key);
    await writeDeskEvent("login_denied", key.slice(0, 120));
    return { error: "Access denied." };
  }

  opsClearFails(key);
  await setOpsCookie(signOpsToken());
  await writeDeskEvent("login", key.slice(0, 120));
  redirect(opsHref());
}

export async function opsLogoutAction() {
  if (await opsSession()) {
    await writeDeskEvent("logout", "");
    await clearOpsCookie();
  }
  redirect(opsHref("/login"));
}
