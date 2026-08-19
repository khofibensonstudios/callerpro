"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, SendHorizontal } from "lucide-react";
import { LeraAvatar } from "@/components/LeraAvatar";
import { EmojiComposerButton } from "@/components/EmojiPicker";

type Turn = { id: string; role: "user" | "assistant"; content: string; at?: string };

const STORAGE_KEY = "cp_lera_chat_v1";

const GREETING: Turn = {
  id: "greeting",
  role: "assistant",
  content: "Hey! I'm Lera AI. Ask me anything — shop deals, videos to learn from, or help around Connect Pro.",
  at: new Date().toISOString(),
};

function loadHistory(): Turn[] {
  if (typeof window === "undefined") return [GREETING];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [GREETING];
    const parsed = JSON.parse(raw) as Turn[];
    if (!Array.isArray(parsed) || !parsed.length) return [GREETING];
    return parsed;
  } catch {
    return [GREETING];
  }
}

function saveHistory(turns: Turn[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-40)));
  } catch {
    /* ignore quota */
  }
}

function clockTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function LeraMessageBody({ text, mine }: { text: string; mine?: boolean }) {
  const parts = text.split(/(\/(?:shop\/p\/[\w-]+|watch\/[\w-]+|article\/[\w-]+|p\/[\w-]+|shop(?:\/[\w-]+)?))/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith("/")) {
          return (
            <Link
              key={`${part}-${i}`}
              href={part}
              className={`font-semibold underline underline-offset-2 ${mine ? "text-white" : "text-[#e85d04]"}`}
            >
              {part}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export function LeraChatPanel({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<Turn[]>(() => loadHistory());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const warmed = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (warmed.current) return;
    warmed.current = true;
    void fetch("/api/lera/warmup", { method: "POST", credentials: "include" });
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || busy) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setText("");
    const now = new Date().toISOString();
    const userTurn: Turn = { id: `u_${Date.now()}`, role: "user", content: body, at: now };
    const assistantId = `a_${Date.now() + 1}`;
    const placeholder: Turn = { id: assistantId, role: "assistant", content: "", at: now };

    setMessages((m) => [...m, userTurn, placeholder]);
    setBusy(true);

    try {
      const res = await fetch("/api/lera/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          messages: [...messages, userTurn]
            .filter((m) => m.id !== "greeting")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Lera could not reply right now.");
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let gotToken = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk: { token?: string; error?: string; done?: boolean };
          try {
            chunk = JSON.parse(line) as { token?: string; error?: string; done?: boolean };
          } catch {
            continue;
          }
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.token) {
            gotToken = true;
            setMessages((m) =>
              m.map((msg) => (msg.id === assistantId ? { ...msg, content: msg.content + chunk.token } : msg)),
            );
          }
        }
      }

      if (!gotToken) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: "I couldn't get a reply out — please try again." }
              : msg,
          ),
        );
      }
    } catch (err) {
      if (ac.signal.aborted) return;
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((m) =>
        m.map((t) => (t.id === assistantId ? { ...t, content: msg } : t)),
      );
    } finally {
      if (!ac.signal.aborted) {
        setBusy(false);
        requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      }
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-black/8 bg-white px-2 py-2">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-black/5 md:hidden"
            aria-label="Back"
            onClick={onBack}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <span className="relative shrink-0">
            <LeraAvatar size={40} glow />
            <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#22c55e]" />
          </span>
          <div className="min-w-0 pl-2">
            <p className="truncate font-semibold leading-tight">Lera AI</p>
            <p className={`text-xs ${busy ? "text-[#e85d04]" : "text-fb-muted"}`}>{busy ? "typing…" : "Signal"}</p>
          </div>
        </div>
      </header>

      <div ref={listRef} className="hide-scroll min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-3">
        {messages.map((m) => {
          if (m.role === "assistant" && !m.content && busy) return null;
          const mine = m.role === "user";
          const showTime = selectedMsg === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMsg((id) => (id === m.id ? null : m.id))}
              className={`mb-0.5 block w-fit max-w-[75%] rounded-[22px] px-3.5 py-2 text-left text-[15px] leading-5 ${
                mine ? "ml-auto bg-[#141414] text-white" : "bg-[#efefef] text-[#141414]"
              }`}
            >
              <LeraMessageBody text={m.content} mine={mine} />
              {showTime && m.at ? (
                <span className={`mt-1 block text-[11px] ${mine ? "text-white/70" : "text-fb-muted"}`}>
                  {clockTime(m.at)}
                </span>
              ) : (
                <span className={`mt-0.5 block text-right text-[10px] ${mine ? "text-white/50" : "text-fb-muted"}`}>
                  {clockTime(m.at)}
                </span>
              )}
            </button>
          );
        })}
        {busy && !(messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content) ? (
          <p className="w-fit rounded-2xl bg-[#efefef] px-3.5 py-2 text-[13px] text-fb-muted">typing…</p>
        ) : null}
      </div>

      <form
        onSubmit={(e) => void send(e)}
        className="flex shrink-0 items-center gap-0.5 border-t border-black/8 bg-white px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <input
          ref={inputRef}
          className="h-11 min-w-0 flex-1 rounded-full bg-[#f4f1eb] px-4 text-[15px] outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setEmojiOpen(false)}
          placeholder={busy ? "Sending…" : "Message…"}
          enterKeyHint="send"
          disabled={busy}
        />
        <EmojiComposerButton open={emojiOpen} setOpen={setEmojiOpen} onPick={(emoji) => setText((t) => t + emoji)} />
        <button
          type="button"
          disabled={!text.trim() || busy}
          onClick={() => void send()}
          className="grid h-10 w-10 shrink-0 place-items-center disabled:opacity-40"
          aria-label="Send"
        >
          <SendHorizontal className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}

export function LeraEntryButton({ active, onClick }: { active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="AI"
      className={`grid h-11 w-11 place-items-center rounded-full bg-[#e85d04] text-[11px] font-bold tracking-[0.08em] text-white shadow-[0_8px_20px_rgba(232,93,4,0.35)] ${
        active ? "ring-2 ring-[#141414] ring-offset-2" : ""
      }`}
    >
      AI
    </button>
  );
}
