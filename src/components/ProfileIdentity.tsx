"use client";

import { useState } from "react";
import { ProfileSaveButton } from "./ProfileSaveButton";

export function ProfileIdentity({
  isMe,
  userId,
  callerId,
  savedName,
}: {
  isMe: boolean;
  userId: string;
  callerId?: string;
  savedName?: string;
}) {
  const [name, setName] = useState(savedName || "");

  if (isMe) {
    return callerId ? (
      <h1 className="font-mono text-[18px] font-semibold tracking-[0.18em]">{callerId}</h1>
    ) : (
      <h1 className="text-[15px] font-semibold">Profile</h1>
    );
  }

  return (
    <div>
      {name ? <h1 className="text-[15px] font-semibold tracking-tight">{name}</h1> : null}
      {callerId ? (
        <p className={`font-mono tracking-[0.18em] ${name ? "mt-1 text-[15px]" : "text-[18px] font-semibold"}`}>{callerId}</p>
      ) : null}
      {!name ? <ProfileSaveButton userId={userId} callerId={callerId} onSaved={setName} /> : null}
    </div>
  );
}
