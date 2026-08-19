"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Camera, Image as ImageIcon, SquarePlus, Video } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { HiddenFileInput } from "./HiddenFileInput";
import { stashCreateMedia } from "@/lib/pending-create";

const CreateFlowContext = createContext<{ start: () => void }>({
  start: () => {},
});

export function useCreateFlow() {
  return useContext(CreateFlowContext);
}

export function CreateFlowProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"off" | "kind" | "source">("off");
  const [media, setMedia] = useState<"note" | "video">("note");

  const start = useCallback(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    setStep("kind");
  }, [router, user]);

  function chooseMedia(next: "note" | "video") {
    setMedia(next);
    setStep("source");
  }

  function chooseSource(source: "camera" | "gallery") {
    const input = fileRef.current;
    if (!input) return;
    input.accept = media === "video" ? "video/*,video/mp4,video/quicktime,.mp4,.mov,.m4v" : "image/*";
    if (source === "camera") input.setAttribute("capture", "environment");
    else input.removeAttribute("capture");
    input.click();
    setStep("off");
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    stashCreateMedia(media, file);
    window.dispatchEvent(new Event("connect-create-media"));
    router.push(media === "video" ? "/create?kind=video" : "/create?kind=note");
  }

  const sheet =
    step === "off"
      ? null
      : createPortal(
          <div className="fixed inset-0 z-[400] flex items-end bg-black/50" onClick={() => setStep("off")}>
            <div
              className="w-full rounded-t-2xl bg-[#f4f1eb] px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-black/20" />
              {step === "kind" ? (
                <>
                  <p className="px-4 pb-1 text-sm font-semibold">Create post</p>
                  <button
                    type="button"
                    className="flex h-14 w-full items-center gap-3 px-4 text-left"
                    onClick={() => chooseMedia("video")}
                  >
                    <Video className="h-5 w-5" />
                    Post a video
                  </button>
                  <button
                    type="button"
                    className="flex h-14 w-full items-center gap-3 px-4 text-left"
                    onClick={() => chooseMedia("note")}
                  >
                    <ImageIcon className="h-5 w-5" />
                    Post a picture
                  </button>
                </>
              ) : (
                <>
                  <p className="px-4 pb-1 text-sm font-semibold">
                    {media === "video" ? "Post a video" : "Post a picture"}
                  </p>
                  <button
                    type="button"
                    className="flex h-14 w-full items-center gap-3 px-4 text-left"
                    onClick={() => chooseSource("camera")}
                  >
                    <Camera className="h-5 w-5" />
                    Camera
                  </button>
                  <button
                    type="button"
                    className="flex h-14 w-full items-center gap-3 px-4 text-left"
                    onClick={() => chooseSource("gallery")}
                  >
                    <ImageIcon className="h-5 w-5" />
                    Gallery
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        );

  return (
    <CreateFlowContext.Provider value={{ start }}>
      {children}
      {sheet}
      <HiddenFileInput
        inputRef={fileRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          onFile(file);
        }}
      />
    </CreateFlowContext.Provider>
  );
}

export function CreatePlusButton({ className }: { className?: string }) {
  const { start } = useCreateFlow();
  return (
    <button
      type="button"
      onClick={start}
      className={
        className ||
        "grid h-10 w-10 place-items-center rounded-full text-[#141414] hover:bg-black/5"
      }
      title="New post"
      aria-label="New post"
    >
      <SquarePlus className="h-6 w-6" strokeWidth={2.25} />
    </button>
  );
}

export function CreateSideButton({ icon: Icon }: { icon: typeof SquarePlus }) {
  const { start } = useCreateFlow();
  return (
    <button
      type="button"
      onClick={start}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-[15px] font-medium hover:bg-black/5"
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      Create
    </button>
  );
}
