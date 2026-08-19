"use client";

import { useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";
import { useAuth } from "./AuthProvider";
import { compactCount } from "@/lib/time";

export type SheetPerson = {
  id: string;
  name: string;
  headline?: string;
  avatarHue: number;
  avatarUrl?: string;
};

export function ProfilePeopleSheet({
  followers,
  following,
  likes,
  myFollowingIds,
  isMe,
}: {
  followers: SheetPerson[];
  following: SheetPerson[];
  likes: number;
  myFollowingIds: string[];
  isMe?: boolean;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState<"followers" | "following" | null>(null);
  const people = open === "followers" ? followers : following;
  const num = "text-center text-[16px] font-bold tracking-tight leading-none";
  const lab = "mt-1 px-0.5 text-center text-[11px] font-medium leading-tight text-[#6f6a64]";

  return (
    <>
      <div className="grid min-w-0 flex-1 grid-cols-3">
        <button type="button" onClick={() => setOpen("followers")} className={num}>
          {compactCount(followers.length)}
        </button>
        <button type="button" onClick={() => setOpen("following")} className={num}>
          {compactCount(following.length)}
        </button>
        <p className={num}>{compactCount(likes)}</p>
        <button type="button" onClick={() => setOpen("followers")} className={lab}>
          {followers.length === 1 ? "follower" : "followers"}
        </button>
        <button type="button" onClick={() => setOpen("following")} className={lab}>
          following
        </button>
        <p className={lab}>{likes === 1 ? "like" : "likes"}</p>
      </div>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-[400] flex items-end bg-black/40" onClick={() => setOpen(null)}>
              <div
                className="flex max-h-[78vh] w-full flex-col rounded-t-2xl bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
                  <p className="text-sm font-bold">{open === "followers" ? "Followers" : "Following"}</p>
                  <button type="button" onClick={() => setOpen(null)} className="grid h-8 w-8 place-items-center" aria-label="Close">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <ul className="min-h-0 flex-1 overflow-y-auto">
                  {people.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Link href={`/u/${p.id}`} onClick={() => setOpen(null)} className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar name={p.name} hue={p.avatarHue} src={p.avatarUrl} size={40} userId={p.id} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{p.name}</span>
                          {p.headline ? <span className="block truncate text-xs text-fb-muted">{p.headline}</span> : null}
                        </span>
                      </Link>
                      {user && user.id !== p.id ? (
                        <FollowButton
                          userId={p.id}
                          iFollow={myFollowingIds.includes(p.id)}
                          theyFollow={!!isMe && open === "followers"}
                        />
                      ) : null}
                    </li>
                  ))}
                  {people.length === 0 ? (
                    <li className="px-4 py-8 text-center text-sm text-fb-muted">Nobody here yet.</li>
                  ) : null}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
