"use client";

export function LiveEndSheet({ onDone }: { onDone: () => void; summary?: unknown }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/70 text-white">
      <div className="w-full overflow-hidden rounded-t-[1.5rem] bg-[#111]">
        <div className="flex justify-center pt-3 pb-1">
          <span className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        <div className="px-5 pt-3 pb-2 text-center">
          <p className="text-[20px] font-semibold tracking-tight">Live ended</p>
          <p className="mt-1.5 text-[14px] text-white/55">Thanks for going live.</p>
        </div>
        <div className="px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onDone}
            className="flex h-12 w-full items-center justify-center rounded-full bg-[#e85d04] text-[16px] font-semibold text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
