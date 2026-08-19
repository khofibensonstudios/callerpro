import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { touchPresence } from "@/lib/chat-presence";

export function OPTIONS() {
  return options();
}

export async function POST(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  const body = await req.json().catch(() => ({}));
  const typingThread =
    typeof body?.typingThread === "string"
      ? body.typingThread
      : body?.typing === false
        ? null
        : undefined;
  await touchPresence(me, typingThread);
  return json({ ok: true });
}
