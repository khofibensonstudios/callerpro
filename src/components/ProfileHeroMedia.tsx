"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Avatar } from "./Avatar";
import { useAuth } from "./AuthProvider";

function usePhotoSave() {
  const { refresh } = useAuth();
  async function save(field: "avatarUrl" | "coverUrl", value: string) {
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) await refresh();
    return res.ok;
  }
  function readFile(file: File, field: "avatarUrl" | "coverUrl", onDone: (v: string) => void) {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      if (value) save(field, value).then((ok) => ok && onDone(value));
    };
    reader.readAsDataURL(file);
  }
  return { readFile };
}

export function ProfileCover({
  isMe,
  hue,
  coverUrl,
}: {
  isMe: boolean;
  hue: number;
  coverUrl?: string;
}) {
  const { readFile } = usePhotoSave();
  const [cover, setCover] = useState(coverUrl);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="relative">
        <button type="button" className="block w-full" onClick={() => setOpen(true)}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-32 w-full object-cover md:h-48" />
          ) : (
            <div
              className="h-32 md:h-48"
              style={{
                background: `linear-gradient(90deg, hsl(${hue} 50% 35%), hsl(${hue + 40} 50% 25%))`,
              }}
            />
          )}
        </button>
        {isMe ? (
          <button
            type="button"
            className="absolute right-3 bottom-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
            aria-label="Change cover photo"
            onClick={() => input.current?.click()}
          >
            <Camera className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file, "coverUrl", setCover);
        }}
      />
      {open ? (
        <Viewer
          onClose={() => setOpen(false)}
          canChange={isMe}
          onChange={() => input.current?.click()}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="max-h-[70vh] w-full max-w-3xl object-contain" />
          ) : (
            <p className="text-white/60">No cover photo</p>
          )}
        </Viewer>
      ) : null}
    </>
  );
}

export function ProfilePhoto({
  isMe,
  name,
  hue,
  avatarUrl,
  userId,
}: {
  isMe: boolean;
  name: string;
  hue: number;
  avatarUrl?: string;
  userId: string;
}) {
  const { readFile } = usePhotoSave();
  const [src, setSrc] = useState(avatarUrl);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const photo = (
    <Avatar name={name} hue={hue} src={src} size={86} userId={userId} />
  );

  return (
    <>
      <div className="relative inline-grid shrink-0">
        <button type="button" className="block" onClick={() => setOpen(true)}>
          {photo}
        </button>
        {isMe ? (
          <button
            type="button"
            className="absolute -right-0.5 -bottom-0.5 z-20 grid h-7 w-7 place-items-center rounded-full bg-[#141414] text-white ring-2 ring-white"
            aria-label="Change profile photo"
            onClick={() => input.current?.click()}
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file, "avatarUrl", setSrc);
        }}
      />
      {open ? (
        <Viewer
          onClose={() => setOpen(false)}
          canChange={isMe}
          onChange={() => input.current?.click()}
        >
          <Avatar name={name} hue={hue} src={src} size={200} userId={userId} />
        </Viewer>
      ) : null}
    </>
  );
}

function Viewer({
  children,
  onClose,
  canChange,
  onChange,
}: {
  children: React.ReactNode;
  onClose: () => void;
  canChange: boolean;
  onChange: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/92" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button type="button" className="text-sm">
          Close
        </button>
        {canChange ? (
          <button
            type="button"
            className="text-sm font-semibold"
            onClick={(e) => {
              e.stopPropagation();
              onChange();
            }}
          >
            Change
          </button>
        ) : (
          <span />
        )}
      </div>
      <div className="grid flex-1 place-items-center px-6 pb-10" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
