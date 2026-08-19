"use client";

import Link from "next/link";

export function ProfileActions({ isMe }: { profileId: string; isMe: boolean }) {
  const btn =
    "inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-[#efefef] px-2 text-[13px] font-semibold whitespace-nowrap text-[#141414]";

  if (!isMe) return null;

  return (
    <div className="flex w-full items-center gap-2">
      <Link href="/settings" prefetch={false} className={btn}>
        Settings
      </Link>
      <Link href="/profile/edit" prefetch={false} className={btn}>
        Edit profile
      </Link>
    </div>
  );
}
