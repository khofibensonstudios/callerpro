const OLLAMA = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";

const CHAT_TIMEOUT_MS = 120_000;

export function leraModel() {
  return MODEL;
}

export async function warmupLeraModel() {
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt: "OK",
      stream: false,
      keep_alive: "30m",
      options: { num_predict: 1 },
    }),
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
  });
  return res.ok;
}

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function streamLeraChat(
  messages: ChatMsg[],
  onToken: (token: string) => void,
): Promise<string> {
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      keep_alive: "30m",
      messages,
      options: { temperature: 0.6, num_predict: 180 },
    }),
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "");
    throw new Error(err.slice(0, 300) || `Ollama HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let chunk: { message?: { content?: string }; done?: boolean };
      try {
        chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
      } catch {
        continue;
      }
      const token = chunk.message?.content || "";
      if (token) {
        full += token;
        onToken(token);
      }
    }
  }

  const reply = full.trim();
  if (!reply) throw new Error("Empty reply from model");
  return reply;
}

export async function leraReachable() {
  try {
    const res = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}
