"use client";

import { useState } from "react";
import { SaveContactSheet } from "./SaveContactSheet";

export function ProfileSaveButton({
  userId,
  callerId,
  onSaved,
}: {
  userId: string;
  callerId?: string;
  onSaved: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex h-9 items-center rounded-lg bg-[#efefef] px-3 text-[13px] font-semibold"
      >
        Save contact
      </button>
      {open ? (
        <SaveContactSheet
          userId={userId}
          callerId={callerId}
          onSaved={(name) => {
            setOpen(false);
            onSaved(name);
          }}
          onSkip={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
