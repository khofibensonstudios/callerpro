"use client";

import { useState, useTransition } from "react";
import {
  adjustWalletAction,
  deleteCommentAction,
  deletePostAction,
  deleteProductAction,
  endLiveAction,
  flagTargetAction,
  hidePostAction,
  resolveReportAction,
  resolveWithdrawalAction,
  reviewShopAction,
  setProductPublishedAction,
  setUserStatusAction,
} from "@/app/ops/actions";
import type { AccountStatus } from "@/lib/types";

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  function run(fn: () => Promise<{ error?: string } | { ok: true }>, next?: string) {
    setError("");
    start(async () => {
      const res = await fn();
      if ("error" in res && res.error) {
        setError("Could not complete that.");
        return;
      }
      if (next) window.location.assign(next);
      else window.location.reload();
    });
  }
  return { pending, error, run };
}

export function UserStatusButtons({ id, status }: { id: string; status: AccountStatus }) {
  const { pending, error, run } = useAction();
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status !== "active" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setUserStatusAction(id, "active"))}
            className="ops-btn ops-btn-primary"
          >
            Restore
          </button>
        ) : null}
        {status !== "suspended" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setUserStatusAction(id, "suspended", "Suspended from console"))}
            className="ops-btn"
          >
            Suspend
          </button>
        ) : null}
        {status !== "banned" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setUserStatusAction(id, "banned", "Banned from console"))}
            className="ops-btn ops-btn-danger"
          >
            Ban
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-[#ff7a68]">{error}</p> : null}
    </div>
  );
}

export function WalletAdjustForm({ id }: { id: string }) {
  const { pending, error, run } = useAction();
  const [usd, setUsd] = useState("0");
  const [note, setNote] = useState("");
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => adjustWalletAction(id, Number(usd), note));
      }}
    >
      <label className="text-sm">
        <span className="block text-[11px] font-semibold tracking-wide text-[#9c968c] uppercase">USD</span>
        <input
          value={usd}
          onChange={(e) => setUsd(e.target.value)}
          className="mt-1 h-10 w-28 rounded-xl border px-3"
        />
      </label>
      <label className="min-w-[160px] flex-1 text-sm">
        <span className="block text-[11px] font-semibold tracking-wide text-[#9c968c] uppercase">Note</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 h-10 w-full rounded-xl border px-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="ops-btn ops-btn-primary"
      >
        Apply
      </button>
      {error ? <p className="w-full text-sm text-[#ff7a68]">{error}</p> : null}
    </form>
  );
}

export function PostModButtons({ id, hidden, nextHref }: { id: string; hidden: boolean; nextHref?: string }) {
  const { pending, error, run } = useAction();
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => hidePostAction(id, !hidden, hidden ? "" : "Removed from console"), nextHref)}
          className="ops-btn"
        >
          {hidden ? "Restore to feed" : "Remove from feed"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("Delete this post permanently?")) return;
            run(() => deletePostAction(id), nextHref);
          }}
          className="ops-btn ops-btn-danger"
        >
          Delete
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-[#ff7a68]">{error}</p> : null}
    </div>
  );
}

export function CommentDeleteButton({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => deleteCommentAction(id))}
      className="text-sm font-semibold text-[#ff7a68] disabled:opacity-40"
    >
      Delete
    </button>
  );
}

export function EndLiveButton({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => endLiveAction(id))}
      className="ops-btn ops-btn-danger"
    >
      End live
    </button>
  );
}

export function ShopReviewButtons({
  userId,
  status,
  nextHref,
}: {
  userId: string;
  status: string;
  nextHref: string;
}) {
  const { pending, error, run } = useAction();
  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || status === "verified"}
          onClick={() => run(() => reviewShopAction(userId, "verified"), nextHref)}
          className="ops-btn ops-btn-primary h-12 px-6"
        >
          {status === "verified" ? "Verified" : "Verify"}
        </button>
        <button
          type="button"
          disabled={pending || status === "rejected"}
          onClick={() => run(() => reviewShopAction(userId, "rejected"), nextHref)}
          className="ops-btn ops-btn-danger h-12 px-6"
        >
          {status === "rejected" ? "Rejected" : "Reject"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-[#ff7a68]">{error}</p> : null}
    </div>
  );
}

export function ProductButtons({ id, published }: { id: string; published: boolean }) {
  const { pending, run } = useAction();
  return (
    <div className="flex gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setProductPublishedAction(id, !published))}
        className="text-sm font-semibold"
      >
        {published ? "Unpublish" : "Publish"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this product?")) return;
          run(() => deleteProductAction(id));
        }}
        className="text-sm font-semibold text-[#ff7a68]"
      >
        Delete
      </button>
    </div>
  );
}

export function FlagButton({
  type,
  id,
}: {
  type: "user" | "post" | "comment" | "shop" | "live";
  id: string;
}) {
  const { pending, run } = useAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => flagTargetAction(type, id, "Flagged from console"))}
      className="ops-btn"
    >
      Open report
    </button>
  );
}

export function ReportButtons({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <div className="flex gap-3">
      <button type="button" disabled={pending} onClick={() => run(() => resolveReportAction(id, "reviewing"))} className="text-sm font-semibold">
        Reviewing
      </button>
      <button type="button" disabled={pending} onClick={() => run(() => resolveReportAction(id, "resolved"))} className="text-sm font-semibold">
        Resolve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => resolveReportAction(id, "dismissed"))}
        className="text-sm font-semibold text-[#ff7a68]"
      >
        Dismiss
      </button>
    </div>
  );
}

export function WithdrawalButtons({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <div className="flex gap-3">
      <button type="button" disabled={pending} onClick={() => run(() => resolveWithdrawalAction(id, "approved"))} className="text-sm font-semibold">
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => resolveWithdrawalAction(id, "rejected"))}
        className="text-sm font-semibold text-[#ff7a68]"
      >
        Reject
      </button>
    </div>
  );
}
