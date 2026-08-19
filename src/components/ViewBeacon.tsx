"use client";

import { useEffect } from "react";

export function ViewBeacon({ postId }: { postId: string }) {
  useEffect(() => {
    const t = window.setTimeout(() => {
      fetch(`/api/posts/${postId}/view`, { method: "POST" });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [postId]);
  return null;
}
