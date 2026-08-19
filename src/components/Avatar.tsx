"use client";

import { useState } from "react";

export function Avatar({
  name,
  hue,
  size = 40,
  src,
  userId: _userId,
  liveLink: _liveLink,
  showLive: _showLive,
}: {
  name: string;
  hue: number;
  size?: number;
  src?: string | null;
  userId?: string | null;
  liveLink?: boolean;
  showLive?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const initial = name.trim().slice(0, 1).toUpperCase() || "C";

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        suppressHydrationWarning
        className="aspect-square shrink-0 rounded-full object-cover"
        style={{ width: `${size}px`, height: `${size}px`, minWidth: `${size}px`, minHeight: `${size}px` }}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      suppressHydrationWarning
      className="grid aspect-square shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        fontSize: `${Math.round(size * 0.4)}px`,
        backgroundColor: `hsl(${hue || 28}, 70%, 42%)`,
      }}
    >
      {initial}
    </div>
  );
}
