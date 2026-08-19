export function GmailMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#4CAF50" d="M45 16.2 40 19l-5 4.7V40h7c1.7 0 3-1.3 3-3V16.2z" />
      <path fill="#1E88E5" d="M3 16.2 6.6 17.9 13 23.7V40H6c-1.7 0-3-1.3-3-3V16.2z" />
      <path fill="#E53935" d="M35 11.2 24 19.45 13 11.2 12 17l1 6.7 11 8.25 11-8.25 1-6.7z" />
      <path fill="#C62828" d="M3 12.3V16.2l10 7.5V11.2L9.9 8.3c-.8-.5-1.9-.4-2.5.3L3 12.3z" />
      <path fill="#C62828" d="M45 12.3 40.6 8.6c-.6-.7-1.7-.8-2.5-.3L35 11.2v12.5l10-7.5v-3.9z" />
    </svg>
  );
}

export function ICloudMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#3693F3"
        d="M38.6 20.1A10.6 10.6 0 0 0 19.2 18a8.2 8.2 0 0 0-7.7 8.1c0 .4 0 .8.1 1.2A7.7 7.7 0 0 0 12.2 42h20.6A8.7 8.7 0 0 0 45 31.2a8.7 8.7 0 0 0-6.4-8.5Z"
      />
      <path
        fill="#5AC8FA"
        d="M38.6 20.1A10.6 10.6 0 0 0 28 16c-.9 0-1.8.1-2.6.3A10.6 10.6 0 0 1 38.8 28c0 .4 0 .7-.1 1.1A8.7 8.7 0 0 1 32.8 42h6.2A8.7 8.7 0 0 0 45 31.2a8.7 8.7 0 0 0-6.4-11.1Z"
        opacity=".85"
      />
    </svg>
  );
}

export function SocialLoginRow({
  busy,
  onPick,
}: {
  busy?: boolean;
  onPick: (provider: string) => void;
}) {
  return (
    <div className="mt-10 max-w-sm">
      <div className="mb-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-[#141414]/12" />
        <span className="text-[11px] font-medium tracking-[0.12em] text-[#8a8580] uppercase">
          Or sign in with
        </span>
        <span className="h-px flex-1 bg-[#141414]/12" />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => onPick("google")}
          className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-2xl bg-white text-sm font-medium text-[#3a3a3a] shadow-[0_4px_14px_rgba(20,20,20,0.08)] transition hover:shadow-[0_6px_18px_rgba(20,20,20,0.12)] disabled:opacity-50"
        >
          <GmailMark />
          Gmail
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onPick("apple")}
          className="flex h-12 flex-1 items-center justify-center gap-2.5 rounded-2xl bg-white text-sm font-medium text-[#3a3a3a] shadow-[0_4px_14px_rgba(20,20,20,0.08)] transition hover:shadow-[0_6px_18px_rgba(20,20,20,0.12)] disabled:opacity-50"
        >
          <ICloudMark />
          iCloud
        </button>
      </div>
    </div>
  );
}
