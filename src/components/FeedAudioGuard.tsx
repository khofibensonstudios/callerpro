"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pauseFeedVideos } from "@/lib/feed-sound";

export function FeedAudioGuard() {
  const path = usePathname();

  useEffect(() => {
    if (path !== "/") pauseFeedVideos();
  }, [path]);

  return null;
}
