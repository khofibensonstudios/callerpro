"use client";

type LeraAvatarProps = {
  size?: number;
  glow?: boolean;
  className?: string;
};

export function LeraAvatar({ size = 44, glow = false, className = "" }: LeraAvatarProps) {
  const inner = Math.max(size - (glow ? 8 : 0), 28);

  const face = (
    <span
      className={`relative z-[2] grid place-items-center rounded-full bg-gradient-to-br from-[#141414] via-[#2a2a2a] to-[#e85d04] text-white shadow-sm ${className}`}
      style={{ width: inner, height: inner }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="h-[55%] w-[55%]" fill="none">
        <path
          d="M8 20c2.5-5 5.5-7 8-7s5.5 2 8 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="12" cy="13" r="1.6" fill="currentColor" />
        <circle cx="20" cy="13" r="1.6" fill="currentColor" />
        <path d="M14 4l2 3 3-1-1 3 2 2-3-1-2 3-1-3-3 1 1-3-2-2 3 1z" fill="#e85d04" opacity="0.9" />
      </svg>
    </span>
  );

  if (!glow) return face;

  return (
    <span className="lera-glow-wrap relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <span className="lera-glow-ring" aria-hidden />
      {face}
    </span>
  );
}
