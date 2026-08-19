import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { gatherLeraContext } from "@/lib/lera-context";
import { streamLeraChat } from "@/lib/lera-ollama";

export const maxDuration = 300;

export function OPTIONS() {
  return options();
}

const SYSTEM = `You are Lera AI on Connect Pro. Be warm, brief, and helpful. Reply in 1–3 short sentences unless asked for more. You help with shop products, chats, calls, groups, and using the app. Never pretend to be human.`;

type ChatTurn = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const userId = await userIdFromRequest(req);
  if (!userId) return json({ error: "Sign in required." }, 401);

  const body = (await req.json().catch(() => null)) as { messages?: ChatTurn[] } | null;
  const messages = body?.messages?.filter((m) => m.content?.trim() && (m.role === "user" || m.role === "assistant"));
  if (!messages?.length) return json({ error: "No messages." }, 400);

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return json({ error: "No user message." }, 400);

  let context = "";
  try {
    context = await gatherLeraContext(lastUser.content);
  } catch {
    /* optional */
  }

  const systemWithContext = context
    ? `${SYSTEM}\n\nPlatform context:\n${context}`
    : SYSTEM;

  const ollamaMessages = [
    { role: "system" as const, content: systemWithContext },
    ...messages.slice(-8).map((m) => ({ role: m.role as "user" | "assistant", content: m.content.trim() })),
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamLeraChat(ollamaMessages, (token) => {
          controller.enqueue(encoder.encode(`${JSON.stringify({ token })}\n`));
        });
        controller.enqueue(encoder.encode(`${JSON.stringify({ done: true })}\n`));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Lera could not reply";
        controller.enqueue(encoder.encode(`${JSON.stringify({ error: msg })}\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
