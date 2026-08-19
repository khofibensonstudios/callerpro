"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { opsSession } from "@/lib/ops-auth";
import {
  adjustWallet,
  createReport,
  deleteCommentAsOps,
  deletePostAsOps,
  endLiveAsOps,
  hidePost,
  opsDeleteProduct,
  opsSetProductPublished,
  resolveReport,
  resolveWithdrawal,
  setShopStatus,
  setUserStatus,
  writeDeskEvent,
} from "@/lib/ops-data";
import { defaultOpsSettings, saveOpsSettings } from "@/lib/ops-settings";
import { opsHref } from "@/lib/ops-path";
import type { AccountStatus } from "@/lib/types";

async function gate() {
  return opsSession();
}

function refresh() {
  revalidatePath("/ops", "layout");
}

export async function reviewShopAction(userId: string, status: "verified" | "rejected") {
  if (!(await gate())) return { error: "denied" as const };
  const shop = await setShopStatus(userId, status);
  if (!shop) return { error: "missing" as const };
  refresh();
  return { ok: true as const, status: shop.status };
}

export async function setUserStatusAction(id: string, status: AccountStatus, reason = "") {
  if (!(await gate())) return { error: "denied" as const };
  if (!["active", "suspended", "banned"].includes(status)) return { error: "invalid" as const };
  const ok = await setUserStatus(id, status, reason);
  refresh();
  return ok ? { ok: true as const } : { error: "missing" as const };
}

export async function adjustWalletAction(id: string, usd: number, note = "") {
  if (!(await gate())) return { error: "denied" as const };
  if (!Number.isFinite(usd) || Math.abs(usd) > 100000) return { error: "invalid" as const };
  const ok = await adjustWallet(id, usd, note);
  refresh();
  return ok ? { ok: true as const } : { error: "missing" as const };
}

export async function hidePostAction(id: string, hidden: boolean, reason = "") {
  if (!(await gate())) return { error: "denied" as const };
  const ok = await hidePost(id, hidden, reason);
  refresh();
  return ok ? { ok: true as const } : { error: "missing" as const };
}

export async function deletePostAction(id: string) {
  if (!(await gate())) return { error: "denied" as const };
  const ok = await deletePostAsOps(id);
  refresh();
  return ok ? { ok: true as const } : { error: "missing" as const };
}

export async function deleteCommentAction(id: string) {
  if (!(await gate())) return { error: "denied" as const };
  const ok = await deleteCommentAsOps(id);
  refresh();
  return ok ? { ok: true as const } : { error: "missing" as const };
}

export async function endLiveAction(id: string) {
  if (!(await gate())) return { error: "denied" as const };
  const ok = await endLiveAsOps(id);
  refresh();
  return ok ? { ok: true as const } : { error: "missing" as const };
}

export async function setProductPublishedAction(id: string, published: boolean) {
  if (!(await gate())) return { error: "denied" as const };
  const product = await opsSetProductPublished(id, published);
  refresh();
  return product ? { ok: true as const } : { error: "missing" as const };
}

export async function deleteProductAction(id: string) {
  if (!(await gate())) return { error: "denied" as const };
  const ok = await opsDeleteProduct(id);
  refresh();
  return ok ? { ok: true as const } : { error: "missing" as const };
}

export async function flagTargetAction(targetType: "user" | "post" | "comment" | "shop" | "live", targetId: string, reason: string) {
  if (!(await gate())) return { error: "denied" as const };
  await createReport({ targetType, targetId, reason });
  refresh();
  return { ok: true as const };
}

export async function resolveReportAction(id: string, status: "resolved" | "dismissed" | "reviewing", notes = "") {
  if (!(await gate())) return { error: "denied" as const };
  const row = await resolveReport(id, status, notes);
  refresh();
  return row ? { ok: true as const } : { error: "missing" as const };
}

export async function resolveWithdrawalAction(id: string, status: "approved" | "rejected") {
  if (!(await gate())) return { error: "denied" as const };
  const ok = await resolveWithdrawal(id, status);
  refresh();
  return ok ? { ok: true as const } : { error: "missing" as const };
}

export async function saveOpsSettingsAction(formData: FormData) {
  if (!(await gate())) return;
  const next = defaultOpsSettings();
  next.theme = formData.get("dark") ? "dark" : "light";
  next.blockedWords = String(formData.get("blockedWords") || "");
  next.wordRobot = Boolean(formData.get("wordRobot"));
  next.commentRobot = Boolean(formData.get("commentRobot"));
  next.liveRobot = Boolean(formData.get("liveRobot"));
  next.autoHold = Boolean(formData.get("autoHold"));
  next.payoutThresholdUsd = Math.max(1, Number(formData.get("payoutThresholdUsd")) || next.payoutThresholdUsd);
  next.liveMinFollowers = Math.max(0, Number(formData.get("liveMinFollowers")) || 0);
  await saveOpsSettings(next);
  await writeDeskEvent("settings", `theme ${next.theme}`);
  refresh();
  redirect(opsHref("/settings"));
}
