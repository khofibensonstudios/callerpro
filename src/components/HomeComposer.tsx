"use client";

import { useCreateFlow } from "./CreateFlow";
import { useAuth } from "./AuthProvider";
import { Avatar } from "./Avatar";

export function HomeComposer() {
  const { user } = useAuth();
  const { start } = useCreateFlow();
  return (
    <section className="mb-4 rounded-2xl bg-white p-3 shadow-sm">
      <button type="button" onClick={start} className="flex w-full items-center gap-3 text-left">
        <Avatar name={user?.name || "You"} hue={user?.avatarHue ?? 210} src={user?.avatarUrl} size={40} />
        <span className="flex h-10 flex-1 items-center rounded-full bg-[#f4f1eb] px-4 text-sm text-fb-muted">
          Share a video or photo
        </span>
      </button>
    </section>
  );
}
