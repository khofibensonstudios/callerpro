"use client";

import { useEffect, useRef } from "react";

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀", "😁", "😂", "🤣", "😊", "😍", "🥰", "😘", "😜", "🤔", "😎", "🥳", "😇", "😅", "😢", "😭", "😤", "😱", "🤗", "🤫",
    ],
  },
  {
    label: "Hands",
    emojis: ["👍", "👎", "👏", "🙌", "🤝", "✌️", "🤞", "👊", "✊", "👋", "🤟", "🫶", "💪", "🙏", "🫡", "👌"],
  },
  {
    label: "Hearts",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💕", "💞", "💖", "💗", "💘", "💝", "🔥", "✨"],
  },
  {
    label: "Fun",
    emojis: ["🎉", "🎊", "🎈", "🎁", "⭐", "🌟", "⚡", "💥", "🎶", "🎵", "📸", "🎬", "🏆", "🎯", "🚀", "💯"],
  },
];

export function EmojiPicker({
  onPick,
  onClose,
  className = "",
  dark = false,
}: {
  onPick: (emoji: string) => void;
  onClose?: () => void;
  className?: string;
  dark?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!root.current) return;
      if (e.target instanceof Node && !root.current.contains(e.target)) onClose?.();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  return (
    <div
      ref={root}
      className={`overflow-hidden rounded-2xl border shadow-[0_12px_40px_rgba(0,0,0,0.18)] ${
        dark ? "border-white/15 bg-[#1a1a1a]" : "border-black/10 bg-white"
      } ${className}`}
      role="listbox"
      aria-label="Emojis"
    >
      <div className="max-h-52 overflow-y-auto p-2">
        {EMOJI_GROUPS.map((g) => (
          <div key={g.label} className="mb-2 last:mb-0">
            <p className={`px-1 pb-1 text-[11px] font-semibold tracking-wide ${dark ? "text-white/40" : "text-black/40"}`}>
              {g.label}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {g.emojis.map((e) => (
                <button
                  key={`${g.label}_${e}`}
                  type="button"
                  onClick={() => onPick(e)}
                  className={`grid h-9 place-items-center rounded-lg text-[20px] transition active:scale-95 ${
                    dark ? "hover:bg-white/10" : "hover:bg-black/5"
                  }`}
                  aria-label={e}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Compact emoji button + popover for composers. */
export function EmojiComposerButton({
  onPick,
  open,
  setOpen,
  dark = false,
}: {
  onPick: (emoji: string) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  dark?: boolean;
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`grid h-9 w-9 place-items-center rounded-full text-[18px] ${
          dark ? "bg-white/10 text-white" : "text-black/70 hover:bg-black/5"
        }`}
        aria-label="Emoji"
        aria-expanded={open}
      >
        😊
      </button>
      {open ? (
        <div className={`absolute bottom-[calc(100%+0.4rem)] z-40 ${dark ? "left-0" : "right-0"}`}>
          <EmojiPicker
            dark={dark}
            className="w-[min(18.5rem,78vw)]"
            onPick={(e) => {
              onPick(e);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
