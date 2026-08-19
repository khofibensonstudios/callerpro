"use client";

import { Delete } from "lucide-react";

export function PinPad({
  value,
  onChange,
  max = 4,
}: {
  value: string;
  onChange: (next: string) => void;
  max?: number;
}) {
  function press(digit: string) {
    if (value.length >= max) return;
    onChange(value + digit);
  }

  function back() {
    onChange(value.slice(0, -1));
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div>
      <div className="mb-8 flex justify-center gap-4">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full border-2 ${
              i < value.length ? "border-[#141414] bg-[#141414]" : "border-[#141414]/25 bg-transparent"
            }`}
          />
        ))}
      </div>
      <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-y-3 gap-x-4">
        {keys.map((k) => (
          <KeyButton key={k} onClick={() => press(k)}>
            {k}
          </KeyButton>
        ))}
        <span />
        <KeyButton onClick={() => press("0")}>0</KeyButton>
        <KeyButton onClick={back} ariaLabel="Delete">
          <Delete className="h-6 w-6" />
        </KeyButton>
      </div>
    </div>
  );
}

function KeyButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="grid h-[72px] w-[72px] place-items-center justify-self-center rounded-full text-[28px] font-medium text-[#141414] active:bg-black/8"
    >
      {children}
    </button>
  );
}
