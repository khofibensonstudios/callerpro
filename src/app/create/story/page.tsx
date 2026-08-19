"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StoryComposer } from "@/components/StoryComposer";
import { fileToJpeg } from "@/lib/resize-image";
import { HiddenFileInput } from "@/components/HiddenFileInput";
import { isVideoFile } from "@/lib/media-file";

export default function StoryCreatePage() {
  const router = useRouter();
  const pickRef = useRef<HTMLInputElement>(null);
  const [shot, setShot] = useState("");
  const [clip, setClip] = useState("");
  const [clipFile, setClipFile] = useState<File | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => pickRef.current?.click(), 50);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      {shot || clip ? (
        <StoryComposer
          startPhoto={shot || undefined}
          startVideo={clip || undefined}
          videoFile={clipFile}
          onShared={() => router.push("/messages")}
          onClose={() => router.push("/messages")}
        />
      ) : null}
      <HiddenFileInput
        inputRef={pickRef}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (!file) {
            router.push("/messages");
            return;
          }
          if (isVideoFile(file) || file.type.startsWith("video")) {
            setClipFile(file);
            setClip(URL.createObjectURL(file));
            return;
          }
          if (!file.type.startsWith("image")) return;
          setClipFile(null);
          setShot(await fileToJpeg(file, 1440, 0.86));
        }}
      />
    </>
  );
}
